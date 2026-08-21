import { createHash } from "node:crypto";
import {
  persistGovernanceTransparencyLedgerEntry,
  persistVendorGovernanceMemory,
  readLatestGovernanceTransparencyEntryHash,
  readLatestReviewReleaseResponse,
  readReviewReleaseAssignment,
  readReviewReleaseEvidenceRequests,
  updateReviewResponseResponses,
  persistGovernanceReleaseManifest,
} from "@/lib/repositories/review-release-repository";
import { buildCanonicalGovernanceArtifact } from "@/lib/governance/canonical-governance-artifact";
import { buildGovernanceReleasePackage } from "@/lib/governance/governance-release-package";
import { getReviewEvidence } from "@/lib/evidence/queries";
import { buildEvidenceSnapshot } from "@/lib/evidence/snapshot";
import { checksumJson } from "@/lib/evidence/checksum";
import { createOrgNotification } from "@/lib/notifications/create-notification";
import { createGovernanceNotarizationReceipt } from "@/lib/governance/notarization";
import { generateLedgerEntry } from "@/lib/governance/transparency-ledger";
import { maybePersistTransparencyCheckpoint } from "@/lib/governance/auto-checkpoint-policy";
import { buildSignedGovernanceManifest } from "@/lib/governance/manifest";
import { signGovernancePayload } from "@/lib/governance-signature";
import {
  governanceChecksum,
} from "@/lib/services/release/release-governance-service";
import {
  buildRemediationSnapshot,
  type ReleaseEvidenceRequestRow,
} from "@/lib/services/release/release-remediation-service";
import {
  consumeReservedReviewCredits,
} from "@/lib/services/release/release-credit-service";


function firstNarrativeValue(...values: any[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "";
}

function reviewerIntelligence(payload: any) {
  return payload?.truvernReviewerIntelligence ?? payload?.reviewerIntelligence ?? {};
}

function safeStr(v: unknown) {
  return typeof v === "string" ? v.trim() : "";
}

function upper(v: unknown) {
  return safeStr(v).toUpperCase();
}

function safeInt(v: unknown) {
  const n = Number(String(v ?? "").trim());
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

export type ReviewReleaseServiceResponse = {
  status: number;
  body: Record<string, unknown>;
};

export type ConfirmReviewReleaseInput = {
  assignmentId: number;
  actorUserId: string;
  acceptedAcknowledgement: boolean;
  acknowledgementType?: string | null;
};

function serviceResult(
  status: number,
  body: Record<string, unknown>,
): ReviewReleaseServiceResponse {
  return {
    status,
    body,
  };
}

function section(text: string, heading: string, stops: string[]) {
  const source = text || "";
  const start = source.toUpperCase().indexOf(heading.toUpperCase());
  if (start < 0) return "";

  const after = source.slice(start + heading.length).trim();
  let end = after.length;

  for (const stop of stops) {
    const idx = after.toUpperCase().indexOf(stop.toUpperCase());
    if (idx >= 0 && idx < end) end = idx;
  }

  return after.slice(0, end).trim();
}

export async function confirmReviewRelease(
  input: ConfirmReviewReleaseInput,
): Promise<ReviewReleaseServiceResponse> {
  const assignmentId =
    safeInt(input.assignmentId);

  const gate = {
    userId: safeStr(input.actorUserId),
  };

  try {if (!assignmentId) {
      return serviceResult(400, { ok: false, error: "Invalid assignment id." });
    }

    const body = {
      acceptedAcknowledgement:
        input.acceptedAcknowledgement === true,
      acknowledgementType:
        safeStr(input.acknowledgementType),
    };

    const acceptedAcknowledgement =
      body?.acceptedAcknowledgement === true;


    if (!acceptedAcknowledgement) {
      return serviceResult(400, {
        ok: false,
        error:
          "Customer acknowledgement acceptance is required before release confirmation.",
      });
    }
    const assignment =
  await readReviewReleaseAssignment(assignmentId);

    if (!assignment) {
      return serviceResult(404, { ok: false, error: "Review assignment not found." });
    }

    const response =
  await readLatestReviewReleaseResponse(assignmentId);

    if (!response) {
      return serviceResult(404, { ok: false, error: "Review response not found." });
    }

    const existing =
      response.responses && typeof response.responses === "object"
        ? response.responses
        : {};

    const releaseState = upper(existing.releaseState);
    const assignmentType = upper(
      existing.assignmentType || assignment.assignmentType || assignment.type,
    );

    const isTruvern = assignmentType === "TRUVERN";
    const isInternal = assignmentType === "INTERNAL";

    const acknowledgementType =
      safeStr(body?.acknowledgementType) ||
      (isInternal
        ? "TRUVERN_OPERATOR_OVERRIDE"
        : "CUSTOMER_RELEASE_CONFIRMATION");

    if (!isTruvern && !isInternal) {
      return serviceResult(409, {
        ok: false,
        error: "Unsupported review assignment type.",
      });
    }

    if (releaseState === "CONFIRMED") {
      const existingSeal =
        existing?.governanceReleaseSnapshot?.governanceSeal &&
        typeof existing.governanceReleaseSnapshot.governanceSeal === "object"
          ? existing.governanceReleaseSnapshot.governanceSeal
          : existing?.governanceSeal || {};

      if (
        existingSeal?.notarizationReceipt &&
        existingSeal?.transparencyLedgerEntry
      ) {

      const creditConsumption = await consumeReservedReviewCredits({
          assignmentId,
          responseId: response.id,
          organizationId: assignment.organizationId,
          vendorId: assignment.vendorId ?? null,
          vendorName: assignment.vendorName ?? null,
        });

          return serviceResult(200, {
          ok: true,
          responseId: response.id,
          releaseState: "CONFIRMED",
          alreadyConfirmed: true,
          checksum: safeStr(existingSeal?.checksum),
          creditConsumption,
        });
      }

      const checksum = safeStr(existingSeal?.checksum);

      if (!checksum) {
        return serviceResult(409, {
          ok: false,
          error: "Confirmed review is missing governance checksum.",
        });
      }

      const sealedAt =
        safeStr(existingSeal?.sealedAt) ||
        safeStr(existing?.confirmedAt) ||
        new Date().toISOString();

      const notarizationReceipt = createGovernanceNotarizationReceipt({
        checksum,
        signature: checksum,
        timestamp: sealedAt,
      });

      const previousEntryHash = await readLatestGovernanceTransparencyEntryHash();

      const transparencyLedgerEntry = generateLedgerEntry({
        assignmentId,
        responseId: response.id,
        checksum,
        ledgerHash: notarizationReceipt.ledgerHash,
        receiptId: notarizationReceipt.receiptId,
        timestamp: sealedAt,
        previousEntryHash,
      });

      await persistGovernanceTransparencyLedgerEntry(transparencyLedgerEntry);
const nextResponses = {
        ...existing,
        governanceSeal: {
          ...existingSeal,
          notarizationReceipt,
          transparencyLedgerEntry,
        },
        governanceReleaseSnapshot: {
          ...(existing.governanceReleaseSnapshot || {}),
          governanceSeal: {
            ...existingSeal,
            notarizationReceipt,
            transparencyLedgerEntry,
          },
        },
      };


      const creditConsumption = await consumeReservedReviewCredits({
        assignmentId,
        responseId: response.id,
        organizationId: assignment.organizationId,
        vendorId: assignment.vendorId ?? null,
        vendorName: assignment.vendorName ?? null,
      });

          return serviceResult(200, {
        ok: true,
        responseId: response.id,
        releaseState: "CONFIRMED",
        alreadyConfirmed: true,
        notarizationBackfilled: true,
        checksum,
        creditConsumption,
      });
    }

    if (releaseState !== "RELEASED") {
      return serviceResult(409, {
        ok: false,
        error: "Only released Truvern outcomes can be confirmed.",
      });
    }

    const structured =
      existing.structuredAssessment &&
      typeof existing.structuredAssessment === "object"
        ? existing.structuredAssessment
        : {};

    const findings = safeStr(existing.findings);

    const reviewerNarrative =
      (structured as any).truvernReviewerIntelligence ||
      (structured as any).reviewerIntelligence ||
      (structured as any).governanceReleaseSnapshot?.truvernReviewerIntelligence ||
      {};

    const executiveSummary =
      safeStr((structured as any).executiveSummary) ||
      safeStr((structured as any).governanceReleaseSnapshot?.executiveSummary) ||
      safeStr(reviewerNarrative.executiveSummary) ||
      section(findings, "EXECUTIVE SUMMARY", [
        "GOVERNANCE DECISION",
        "TRUVERN GOVERNANCE REVIEW",
        "CONDITIONS & FOLLOW-UPS",
      ]);

    const finalAssessment =
      safeStr((structured as any).finalAssessment) ||
      safeStr((structured as any).finalRecommendation) ||
      safeStr((structured as any).governanceReleaseSnapshot?.finalAssessment) ||
      safeStr((structured as any).governanceReleaseSnapshot?.finalRecommendation) ||
      safeStr(reviewerNarrative.finalAssessment) ||
      safeStr(reviewerNarrative.finalRecommendation) ||
      section(findings, "TRUVERN GOVERNANCE REVIEW", [
        "CONDITIONS & FOLLOW-UPS",
      ]);

    const conditions = Array.isArray((structured as any).conditionsAndFollowUps)
      ? (structured as any).conditionsAndFollowUps.map(String).filter(Boolean)
      : section(findings, "CONDITIONS & FOLLOW-UPS", [])
          .split("\n")
          .map((item) => item.trim())
          .filter(Boolean);

    const confirmedAt = existing.confirmedAt || new Date().toISOString();

    const customerAcknowledgement = {
      accepted: true,
      acceptedAt: confirmedAt,
      acceptedByUserId: gate.userId,
      acceptedByOrganizationId: assignment.organizationId,
      acceptanceVersion: "TRV-LEGAL-1.0",
      acknowledgementType,
      statement:
        acknowledgementType === "TRUVERN_OPERATOR_OVERRIDE"
          ? "Authorized Truvern operator acknowledges approval or finalization of this governance outcome on behalf of the workspace."
          : "Customer acknowledges that Truvern governance outcomes are operational governance assessments and not legal guarantees, certifications, warranties, or regulatory attestations.",
    };

    const decision = safeStr(existing.decision) || "Not recorded";
    const riskLevel = safeStr(existing.riskLevel) || "Not recorded";

    const checksum = governanceChecksum({
      assignmentId,
      vendorName: assignment.vendorName,
      decision,
      riskLevel,
      releaseState: "CONFIRMED",
      executiveSummary,
      finalAssessment,
      conditions,
      finalizedAt: confirmedAt,
    });

    const signedGovernancePayload = {
      assignmentId,
      responseId: response.id,
      organizationId: assignment.organizationId,
      vendorId: assignment.vendorId ?? null,
      vendorName: assignment.vendorName ?? null,
      checksum,
      confirmedAt,
      releaseState: "CONFIRMED",
      manifestVersion: "TRV-MANIFEST-1.0",
    };

    const governanceSignature =
      signGovernancePayload(signedGovernancePayload);

    const notarizationReceipt = createGovernanceNotarizationReceipt({
      checksum,
      signature: governanceSignature.signature,
      timestamp: confirmedAt,
    });

    const previousEntryHash = await readLatestGovernanceTransparencyEntryHash();

    const transparencyLedgerEntry = generateLedgerEntry({
      assignmentId,
      responseId: response.id,
      checksum,
      ledgerHash: notarizationReceipt.ledgerHash,
      receiptId: notarizationReceipt.receiptId,
      timestamp: confirmedAt,
      previousEntryHash,
    });

    await persistGovernanceTransparencyLedgerEntry(transparencyLedgerEntry);

    const remediationRows =
      await readReviewReleaseEvidenceRequests(
        Number(assignment.vendorId),
      );
    const {
      remediationRequests,
      remediationOpenCount,
      remediationApprovedCount,
      remediationRejectedCount,
      remediationChecksum,
      remediationSnapshot,
    } = buildRemediationSnapshot({
      rows: remediationRows,
      confirmedAt,
      assignmentId,
      responseId: response.id,
      vendorId: assignment.vendorId ?? null,
    });
    const releasedEvidence = await getReviewEvidence(assignmentId);

    const evidenceSnapshot = buildEvidenceSnapshot({
      source: "review",
      sourceId: assignmentId,
      items: releasedEvidence,
    });

    const evidenceManifestChecksum = checksumJson(
      evidenceSnapshot.manifest,
    );

    const existingCanonicalArtifact =
      existing?.canonicalGovernanceArtifact &&
      typeof existing.canonicalGovernanceArtifact === "object"
        ? existing.canonicalGovernanceArtifact
        : existing?.governanceReleaseSnapshot?.canonicalGovernanceArtifact &&
            typeof existing.governanceReleaseSnapshot.canonicalGovernanceArtifact === "object"
          ? existing.governanceReleaseSnapshot.canonicalGovernanceArtifact
          : null;

    const canonicalGovernanceArtifact =
      existingCanonicalArtifact ||
      buildCanonicalGovernanceArtifact({
        executiveSummary,
        finalAssessment,
        finalRecommendation: finalAssessment,
        decision,
        riskLevel,
        findings: Array.isArray(
          (reviewerNarrative as any)?.findings,
        )
          ? (reviewerNarrative as any).findings
          : [],
        conditionsAndFollowUps: conditions,
        boardSummary:
          safeStr((structured as any)?.boardSummary) || executiveSummary,
        customerSummary:
          safeStr((structured as any)?.customerSummary) || finalAssessment,
      });

    const governanceReleasePackage = buildGovernanceReleasePackage({
      canonicalGovernanceArtifact,
      reviewer: {
        userId:
          safeStr((assignment as any)?.reviewerUserId) ||
          safeStr((assignment as any)?.assignedTo) ||
          null,
        name:
          safeStr((assignment as any)?.reviewerName) ||
          safeStr((assignment as any)?.assignedReviewerName) ||
          "Truvern Reviewer",
        role: "Governance Reviewer",
      },
      vendor: {
        id: assignment.vendorId ?? null,
        name: assignment.vendorName || "Vendor",
        category: safeStr((assignment as any)?.vendorCategory) || null,
        tier: safeStr((assignment as any)?.vendorTier) || null,
        criticality:
          safeStr((assignment as any)?.vendorCriticality) || null,
      },
      assessment: {
        assignmentId,
        requestId: assignment.reviewRequestId ?? null,
        responseId: response.id,
        organizationId: assignment.organizationId ?? null,
        frameworkName:
          safeStr((structured as any)?.frameworkName) ||
          "Truvern Governance Review",
        assessmentType: assignmentType || null,
        submittedAnswers:
          Number.isFinite(
            Number((structured as any)?.questionnaireReview?.submittedAnswers),
          )
            ? Number((structured as any).questionnaireReview.submittedAnswers)
            : null,
      },
      evidenceSummary: {
        evidenceFiles: releasedEvidence.length,
        pendingRequests: 0,
        completedRequests: 0,
        missingEvidence: [],
        reviewedEvidence: releasedEvidence
          .map((item: any) =>
            safeStr(item?.filename || item?.name || item?.title),
          )
          .filter(Boolean),
      },
      releasedAt: confirmedAt,
      confirmedAt,
      releaseState: "CONFIRMED",
      immutable: true,
      packageVersion: 1,
    });

const nextResponses = {
      ...existing,
      releaseState: "CONFIRMED",
      confirmedAt,
      confirmation: {
        state: "CONFIRMED",
        confirmedAt,
        source: isInternal ? "internal_review_approval" : "customer_review_desk",
        previousReleaseState: releaseState,
      },

      customerAcknowledgement,
      canonicalGovernanceArtifact,
      governanceReleasePackage,
      governanceReleaseSnapshot: {
        canonicalGovernanceArtifact,
        governanceReleasePackage,
        assignmentId,
        responseId: response.id,
        vendorId: assignment.vendorId ?? null,
        vendorName: assignment.vendorName ?? null,

        releasedAt: confirmedAt,
        releaseState: "CONFIRMED",

        decision,
        riskLevel,

        findings,

        structuredAssessment: structured,

        normalizedAssessment: {
          executiveSummary,
          finalAssessment,
          conditions,
        },

        customerAcknowledgement,

        immutableEvidenceSnapshot: evidenceSnapshot,

        evidenceManifestChecksum,

        evidenceSummary: {
          artifactCount: releasedEvidence.length,
        },

        remediationSnapshot,

        governanceSeal: {
          version: "TRV-GOV-SEAL-1.0",
          algorithm: "SHA-256",
          checksum,
          sealedAt: confirmedAt,
          notarizationReceipt,
          transparencyLedgerEntry,
        cryptographicSignature: governanceSignature,
        },
      },
      governanceSeal: {
        version: "TRV-GOV-SEAL-1.0",
        algorithm: "SHA-256",
        checksum,
        sealedAt: confirmedAt,
        assignmentId,
        responseId: response.id,
        vendorId: assignment.vendorId ?? null,
        vendorName: assignment.vendorName ?? null,
        artifactType: "truvern_governance_packet",
        releaseState: "CONFIRMED",
        notarizationReceipt,
        transparencyLedgerEntry,
        cryptographicSignature: governanceSignature,
      },
    };



    await updateReviewResponseResponses(
      response.id,
      nextResponses,
    );

    // VENDOR_GOVERNANCE_MEMORY_SNAPSHOT
    if (assignment.vendorId) {
      const memorySnapshot = (nextResponses as any).governanceReleaseSnapshot || {};
      const memoryText = [
        findings,
        executiveSummary,
        finalAssessment,
        conditions.join("\n"),
      ].join("\n").toLowerCase();

      const criticalFailures =
        (memoryText.match(/\bcritical\b/g) || []).length +
        (memoryText.match(/\bhigh\b/g) || []).length;

      const partialControls =
        (memoryText.match(/\bpartial\b/g) || []).length +
        (memoryText.match(/\bmedium\b/g) || []).length;

      const governanceScore = Math.max(
        0,
        Math.min(
          100,
          100 -
            criticalFailures * 12 -
            partialControls * 5 -
            remediationOpenCount * 6 -
            (memoryText.includes("breach") ? 18 : 0) -
            (memoryText.includes("federal") || memoryText.includes("investigation") ? 25 : 0),
        ),
      );

      await persistVendorGovernanceMemory({
      vendorId: Number(assignment.vendorId),
      reviewAssignmentId: assignmentId,
      governanceScore,
      governanceDecision: decision,
      residualRisk: riskLevel,
      criticalFailures,
      partialControls,
      missingEvidenceCount: remediationOpenCount,
      remediationCount: remediationRequests.length,
      breachDisclosureDetected:
        memoryText.includes("breach"),
      federalInvestigationDetected:
        memoryText.includes("federal") ||
        memoryText.includes("investigation"),
      governanceNarrative:
        executiveSummary || finalAssessment || null,
      reviewerConditions:
        memorySnapshot?.remediationSnapshot?.reviewerConditions ?? [],
      attestationRequests: [],
      releaseConditions: conditions,
    });
    }
    const creditConsumption = await consumeReservedReviewCredits({
      assignmentId,
      responseId: response.id,
      organizationId: assignment.organizationId,
      vendorId: assignment.vendorId ?? null,
      vendorName: assignment.vendorName ?? null,

    });

    const immutableManifestSnapshot =
      (nextResponses as any).governanceReleaseSnapshot || nextResponses;

    const fundingSnapshot = {
      source: "review_release_confirmation",
      creditConsumption,
      capturedAt: confirmedAt,
    };

    const fundingChecksum = createHash("sha256")
      .update(JSON.stringify(fundingSnapshot))
      .digest("hex")
      .toUpperCase();

    await persistGovernanceReleaseManifest({
      organizationId: assignment.organizationId,
      vendorId: assignment.vendorId ?? null,
      reviewAssignmentId: assignmentId,
      reviewResponseId: response.id,
      checksum,
      fundingChecksum,
      reviewerName: assignment.reviewerName ?? null,
      confirmedAt,
      immutableSnapshot: {
        ...immutableManifestSnapshot,
        fundingSnapshot,
        cryptographicSignature: governanceSignature,
      },
    });
    await createOrgNotification({
      organizationId: Number(assignment?.organizationId || 0) || null,
      type: "TRUVERN_RELEASED",
      severity: "SUCCESS",
      title: `${isInternal ? "Internal review approved" : "Truvern release confirmed"} - ${safeStr(assignment?.vendorName) || "Vendor"}`,
      message: isInternal
        ? "An internal governance review was approved and finalized."
        : "A Truvern governance review was released and is ready for customer action.",
      href: `/review-desk/reviews/${assignmentId}`,
      metadataJson: {
        assignmentId,
        responseId: response?.id || null,
        source: "confirm_release",
      },
    });
return serviceResult(200, {
      ok: true,
      responseId: response.id,
      releaseState: "CONFIRMED",
      checksum,
      creditConsumption,
    });
  } catch (error: any) {
    return serviceResult(500, {
      ok: false,
      error: safeStr(error?.message) || "Failed to confirm release.",
    });
  }
}




































