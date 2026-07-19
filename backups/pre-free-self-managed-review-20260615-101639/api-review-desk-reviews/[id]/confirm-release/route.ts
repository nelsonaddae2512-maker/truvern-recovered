import { createHash } from "node:crypto";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getReviewEvidence } from "@/lib/evidence/queries";
import { buildEvidenceSnapshot } from "@/lib/evidence/snapshot";
import { checksumJson } from "@/lib/evidence/checksum";
import { createOrgNotification } from "@/lib/notifications/create-notification";
import { requireDbOrganization } from "@/lib/org-db";
import { createGovernanceNotarizationReceipt } from "@/lib/governance/notarization";
import { generateLedgerEntry } from "@/lib/governance/transparency-ledger";
import { maybePersistTransparencyCheckpoint } from "@/lib/governance/auto-checkpoint-policy";
import { buildSignedGovernanceManifest } from "@/lib/governance/manifest";
import { signGovernancePayload } from "@/lib/governance-signature";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
async function requireApiAuth() {
  const { userId } = await auth();

  if (!userId) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401, headers: { "cache-control": "no-store" } },
      ),
    };
  }

  try {
    const org = await requireDbOrganization();

    return {
      ok: true as const,
      userId,
      org,
    };
  } catch {
    return {
      ok: false as const,
      response: NextResponse.json(
        { ok: false, error: "Organization required" },
        { status: 403, headers: { "cache-control": "no-store" } },
      ),
    };
  }
}

type RouteContext = {
  params: Promise<{ id: string }>;
};

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

function json(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, {
    status,
    headers: { "cache-control": "no-store" },
  });
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

function governanceChecksum(input: {
  assignmentId: number;
  vendorName?: string | null;
  decision: string;
  riskLevel: string;
  releaseState: string;
  executiveSummary: string;
  finalAssessment: string;
  conditions: string[];
  finalizedAt: unknown;
}) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        assignmentId: input.assignmentId,
        vendor: input.vendorName || null,
        decision: input.decision,
        riskLevel: input.riskLevel,
        releaseState: input.releaseState,
        executiveSummary: input.executiveSummary,
        finalAssessment: input.finalAssessment,
        conditions: input.conditions,
        finalizedAt: input.finalizedAt,
      }),
    )
    .digest("hex")
    .slice(0, 24)
    .toUpperCase();
}

async function latestPreviousEntryHash() {
  const rows: any[] = await prisma.$queryRawUnsafe(
    `
    select "entryHash"
    from "GovernanceTransparencyLog"
    order by timestamp desc, id desc
    limit 1
    `,
  );

  return safeStr(rows?.[0]?.entryHash) || null;
}

async function persistLedgerEntry(entry: ReturnType<typeof generateLedgerEntry>) {
  await prisma.$executeRawUnsafe(
    `
    insert into "GovernanceTransparencyLog" (
      "entryId",
      "assignmentId",
      "responseId",
      checksum,
      "ledgerHash",
      "receiptId",
      timestamp,
      "previousEntryHash",
      "entryHash"
    )
    values (
      $1,$2,$3,$4,$5,$6,$7::timestamptz,$8,$9
    )
    on conflict ("entryId") do nothing
    `,
    entry.entryId,
    entry.assignmentId,
    entry.responseId,
    entry.checksum,
    entry.ledgerHash,
    entry.receiptId,
    entry.timestamp,
    entry.previousEntryHash,
    entry.entryHash,
  );

  await maybePersistTransparencyCheckpoint();
}

async function consumeReservedReviewCredits(input: {
  assignmentId: number;
  responseId: number;
  organizationId: number;
  vendorId?: number | null;
  vendorName?: string | null;
}) {
  const eventKey = `review:${input.assignmentId}:consumption`;

  const alreadyConsumedRows: Array<{ count: number }> =
    await prisma.$queryRawUnsafe(
      `
      select count(*)::int as count
      from "TruvernCreditLedgerEntry"
      where "eventKey" = $1
        and status = 'POSTED'::"TruvernCreditEntryStatus"
      `,
      eventKey,
    );

  if (Number(alreadyConsumedRows?.[0]?.count ?? 0) > 0) {
    return {
      consumed: false,
      alreadyConsumed: true,
      eventKey,
    };
  }

  const reservationRows: Array<{ reservedCredits: number }> =
    await prisma.$queryRawUnsafe(
      `
      select coalesce(sum("reservedDelta"), 0)::int as "reservedCredits"
      from "TruvernCreditLedgerEntry"
      where "organizationId" = $1
        and "reviewAssignmentId" = $2
        and status = 'POSTED'::"TruvernCreditEntryStatus"
      `,
      input.organizationId,
      input.assignmentId,
    );

  const reservedCredits = Number(reservationRows?.[0]?.reservedCredits ?? 0);

  if (reservedCredits <= 0) {
    return {
      consumed: false,
      alreadyConsumed: false,
      reservedCredits,
      eventKey,
    };
  }

  await prisma.$executeRawUnsafe(
    `
    insert into "TruvernCreditLedgerEntry" (
      "organizationId",
      "assessmentRunId",
      "reviewAssignmentId",
      "actorUserId",
      "eventKey",
      "entryType",
      "fundingSource",
      status,
      "availableDelta",
      "reservedDelta",
      "consumedDelta",
      quantity,
      currency,
      "unitPriceCents",
      "amountCents",
      note,
      "metadataJson",
      "createdAt"
    )
    select
      $1,
      null,
      $2,
      null,
      $3,
      'CONSUMPTION'::"TruvernCreditEntryType",
      'PREPAID_CREDITS'::"TruvernCreditFundingSource",
      'POSTED'::"TruvernCreditEntryStatus",
      0,
      $4,
      $5,
      $6,
      null,
      null,
      null,
      $7,
      $8::jsonb,
      now()
    where not exists (
      select 1
      from "TruvernCreditLedgerEntry"
      where "eventKey" = $3
    )
    `,
    input.organizationId,
    input.assignmentId,
    eventKey,
    -reservedCredits,
    reservedCredits,
    reservedCredits,
    `Consumed ${reservedCredits} reserved Truvern credit${reservedCredits === 1 ? "" : "s"} after release confirmation.`,
    JSON.stringify({
      source: "review_release_confirmation",
      assignmentId: input.assignmentId,
      responseId: input.responseId,
      vendorId: input.vendorId ?? null,
      vendorName: input.vendorName ?? null,
      consumedCredits: reservedCredits,
    }),
  );

  return {
    consumed: true,
    alreadyConsumed: false,
    reservedCredits,
    eventKey,
  };
}

export async function POST(req: Request, ctx: RouteContext) {
  const gate = await requireApiAuth();

  if (!gate.ok) {
    return gate.response;
  }

try {
    const params = await ctx.params;
    const assignmentId = safeInt(params?.id);

    if (!assignmentId) {
      return json(400, { ok: false, error: "Invalid assignment id." });
    }

    const body = await req.json().catch(() => ({}));

    const acceptedAcknowledgement =
      body?.acceptedAcknowledgement === true;


    if (!acceptedAcknowledgement) {
      return json(400, {
        ok: false,
        error:
          "Customer acknowledgement acceptance is required before release confirmation.",
      });
    }
    const assignmentRows: any[] = await prisma.$queryRawUnsafe(
      `
      select
        ra.*,
        v.name as "vendorName",
        v.id as "vendorId"
      from "ReviewAssignment" ra
      left join "ReviewRequest" req on req.id = ra."reviewRequestId"
      left join "Vendor" v on v.id = req."vendorId"
      where ra.id = $1
      limit 1
      `,
      assignmentId,
    );

    const assignment = assignmentRows?.[0];

    if (!assignment) {
      return json(404, { ok: false, error: "Review assignment not found." });
    }

    const rows: any[] = await prisma.$queryRawUnsafe(
      `
      select *
      from "ReviewResponse"
      where "reviewAssignmentId" = $1
      order by "updatedAt" desc
      limit 1
      `,
      assignmentId,
    );

    const response = rows?.[0];

    if (!response) {
      return json(404, { ok: false, error: "Review response not found." });
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
      return json(409, {
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

          return json(200, {
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
        return json(409, {
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

      const previousEntryHash = await latestPreviousEntryHash();

      const transparencyLedgerEntry = generateLedgerEntry({
        assignmentId,
        responseId: response.id,
        checksum,
        ledgerHash: notarizationReceipt.ledgerHash,
        receiptId: notarizationReceipt.receiptId,
        timestamp: sealedAt,
        previousEntryHash,
      });

      await persistLedgerEntry(transparencyLedgerEntry);

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

      await prisma.$executeRawUnsafe(
        `
        update "ReviewResponse"
        set
          responses = $1::jsonb,
          "updatedAt" = now()
        where id = $2
        `,
        JSON.stringify(nextResponses),
        response.id,
      );

      const creditConsumption = await consumeReservedReviewCredits({
        assignmentId,
        responseId: response.id,
        organizationId: assignment.organizationId,
        vendorId: assignment.vendorId ?? null,
        vendorName: assignment.vendorName ?? null,
      });

          return json(200, {
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
      return json(409, {
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

    const executiveSummary =
      safeStr((structured as any).executiveSummary) ||
      section(findings, "EXECUTIVE SUMMARY", [
        "GOVERNANCE DECISION",
        "TRUVERN GOVERNANCE REVIEW",
        "CONDITIONS & FOLLOW-UPS",
      ]);

    const finalAssessment =
      safeStr((structured as any).finalAssessment) ||
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

    const previousEntryHash = await latestPreviousEntryHash();

    const transparencyLedgerEntry = generateLedgerEntry({
      assignmentId,
      responseId: response.id,
      checksum,
      ledgerHash: notarizationReceipt.ledgerHash,
      receiptId: notarizationReceipt.receiptId,
      timestamp: confirmedAt,
      previousEntryHash,
    });

    await persistLedgerEntry(transparencyLedgerEntry);

    const remediationRows: Array<{
      id: number;
      title: string | null;
      status: string | null;
      kind: string | null;
      dueAt: Date | string | null;
      fulfilledAt: Date | string | null;
      createdAt: Date | string | null;
      updatedAt: Date | string | null;
    }> = await prisma.$queryRawUnsafe(
      `
      select
        id,
        title::text as title,
        status::text as status,
        kind::text as kind,
        "dueAt",
        "fulfilledAt",
        "createdAt",
        "updatedAt"
      from "EvidenceRequest"
      where "vendorId" = $1
      order by "createdAt" asc, id asc
      `,
      Number(assignment.vendorId),
    );

    const remediationRequests = remediationRows.map((row) => ({
      id: Number(row.id),
      title: safeStr(row.title) || "Evidence request",
      status: upper(row.status) || "UNKNOWN",
      kind: upper(row.kind) || "OTHER",
      dueAt: row.dueAt ? new Date(row.dueAt).toISOString() : null,
      fulfilledAt: row.fulfilledAt ? new Date(row.fulfilledAt).toISOString() : null,
      createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
      updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
    }));

    const remediationOpenCount = remediationRequests.filter((item) =>
      !["APPROVED", "RECEIVED", "COMPLETED", "FULFILLED", "RESOLVED", "REJECTED", "VERIFIED", "CLOSED"].includes(item.status),
    ).length;

    const remediationApprovedCount = remediationRequests.filter((item) =>
      ["APPROVED", "RECEIVED", "COMPLETED", "FULFILLED", "RESOLVED"].includes(item.status),
    ).length;

    const remediationRejectedCount = remediationRequests.filter((item) =>
      item.status === "REJECTED",
    ).length;

    const remediationChecksum = createHash("sha256")
      .update(JSON.stringify(remediationRequests))
      .digest("hex")
      .toUpperCase();

    const releasedEvidence = await getReviewEvidence(assignmentId);

    const evidenceSnapshot = buildEvidenceSnapshot({
      source: "review",
      sourceId: assignmentId,
      items: releasedEvidence,
    });

    const evidenceManifestChecksum = checksumJson(
      evidenceSnapshot.manifest,
    );

    const remediationSnapshot = {
      schema: "truvern.remediation_snapshot.v1",
      generatedAt: confirmedAt,
      vendorId: assignment.vendorId ?? null,
      reviewAssignmentId: assignmentId,
      reviewResponseId: response.id,
      remediationOpenCount,
      remediationApprovedCount,
      remediationRejectedCount,
      remediationCount: remediationRequests.length,
      remediationChecksum,
      remediationRequests,
    };
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
      governanceReleaseSnapshot: {
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

    await prisma.$executeRawUnsafe(
      `
      update "ReviewResponse"
      set
        responses = $1::jsonb,
        "updatedAt" = now()
      where id = $2
      `,
      JSON.stringify(nextResponses),
      response.id,
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

      await prisma.$executeRawUnsafe(
        `
        insert into "VendorGovernanceMemory" (
          "vendorId",
          "reviewAssignmentId",
          "governanceScore",
          "governanceDecision",
          "residualRisk",
          "criticalFailures",
          "partialControls",
          "missingEvidenceCount",
          "remediationCount",
          "breachDisclosureDetected",
          "federalInvestigationDetected",
          "governanceNarrative",
          "reviewerConditions",
          "attestationRequests",
          "releaseConditions"
        )
        values (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14::jsonb,$15::jsonb
        )
        `,
        Number(assignment.vendorId),
        assignmentId,
        governanceScore,
        decision,
        riskLevel,
        criticalFailures,
        partialControls,
        remediationOpenCount,
        remediationRequests.length,
        memoryText.includes("breach"),
        memoryText.includes("federal") || memoryText.includes("investigation"),
        executiveSummary || finalAssessment || null,
        JSON.stringify(memorySnapshot?.remediationSnapshot?.reviewerConditions ?? []),
        JSON.stringify([]),
        JSON.stringify(conditions),
      );
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

    await prisma.$executeRawUnsafe(
      `
      insert into "GovernanceReleaseManifest" (
        "organizationId",
        "vendorId",
        "assessmentRunId",
        "reviewAssignmentId",
        "reviewResponseId",
        "manifestVersion",
        "governanceVersion",
        "releaseState",
        checksum,
        "packetChecksum",
        "fundingChecksum",
        "reviewerName",
        "releasedAt",
        "confirmedAt",
        "finalizedAt",
        "immutableSnapshot",
        "createdAt",
        "updatedAt"
      )
      values (
        $1,
        $2,
        null,
        $3,
        $4,
        'GRM-1.0',
        'TRV-GOV-1.0',
        'CONFIRMED',
        $5,
        $6,
        $7,
        $8,
        $9::timestamptz,
        $9::timestamptz,
        $9::timestamptz,
        $10::jsonb,
        now(),
        now()
      )
      `,
      assignment.organizationId,
      assignment.vendorId ?? null,
      assignmentId,
      response.id,
      checksum,
      checksum,
      fundingChecksum,
      assignment.reviewerName ?? null,
      confirmedAt,
      JSON.stringify({
        ...immutableManifestSnapshot,
        fundingSnapshot,
        cryptographicSignature: governanceSignature,
      }),
    );
        await createOrgNotification({
      organizationId: Number(rows?.[0]?.organizationId || assignment?.organizationId || 0) || null,
      type: "TRUVERN_RELEASED",
      severity: "SUCCESS",
      title: `${isInternal ? "Internal review approved" : "Truvern release confirmed"} - ${safeStr(rows?.[0]?.vendorName) || "Vendor"}`,
      message: isInternal
        ? "An internal governance review was approved and finalized."
        : "A Truvern governance review was released and is ready for customer action.",
      href: `/review-desk/reviews/${assignmentId}`,
      metadataJson: {
        assignmentId,
        responseId: rows?.[0]?.responseId || null,
        source: "confirm_release",
      },
    });
return json(200, {
      ok: true,
      responseId: response.id,
      releaseState: "CONFIRMED",
      checksum,
      creditConsumption,
    });
  } catch (error: any) {
    return json(500, {
      ok: false,
      error: safeStr(error?.message) || "Failed to confirm release.",
    });
  }
}























