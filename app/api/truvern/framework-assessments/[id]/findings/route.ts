import { NextResponse } from "next/server";
import { governanceAuthErrorResponse } from "@/lib/auth/governance-auth-errors";
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { writeGovernanceAuditLog } from "@/lib/governance/audit-log";
import { requireReviewerAccess, requireFrameworkAssessmentAccess } from "@/lib/auth/truvern-governance";
import { generateFindings, type TruvernGeneratedFinding } from "@/lib/governance/findings-engine";
import type { TruvernScoringInput } from "@/lib/governance/scoring-engine";
import { findTruvernFrameworkAssessment } from "@/lib/repositories/truvern-framework-assessment-repository";
import { updateTruvernFrameworkAssessment } from "@/lib/repositories/truvern-framework-assessment-repository";
import { findTruvernAssessmentFindings } from "@/lib/repositories/truvern-assessment-finding-repository";
import { deleteTruvernAssessmentFindings } from "@/lib/repositories/truvern-assessment-finding-repository";
import { createTruvernAssessmentFindings } from "@/lib/repositories/truvern-assessment-finding-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteContext = {
  params: Promise<{ id: string }>;
};

function parseId(value: string) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function stringArray(
  value: unknown,
): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (item): item is string =>
      typeof item === "string" &&
      item.trim().length > 0,
  );
}

function semanticQuestionMetadata(
  value: unknown,
): Record<string, unknown> {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return {};
  }

  return value as Record<
    string,
    unknown
  >;
}

function normalizeEnhancements(
  value: unknown,
) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(
      (
        item,
      ): item is Record<
        string,
        unknown
      > =>
        Boolean(item) &&
        typeof item === "object" &&
        !Array.isArray(item),
    )
    .map((item) => ({
      controlId:
        typeof item.controlId ===
        "string"
          ? item.controlId
          : null,

      title:
        typeof item.title ===
        "string"
          ? item.title
          : null,

      statementText:
        typeof item.statementText ===
        "string"
          ? item.statementText
          : null,

      parameterIds:
        stringArray(
          item.parameterIds,
        ),

      objectiveIds:
        stringArray(
          item.objectiveIds,
        ),

      methodIds:
        stringArray(
          item.methodIds,
        ),

      objectIds:
        stringArray(
          item.objectIds,
        ),

      methodTypes:
        stringArray(
          item.methodTypes,
        ),

      conditionalVendorFollowUp:
        item.conditionalVendorFollowUp ===
        true,

      followUpTrigger:
        typeof item.followUpTrigger ===
        "string"
          ? item.followUpTrigger
          : null,

      evidenceTrigger:
        typeof item.evidenceTrigger ===
        "string"
          ? item.evidenceTrigger
          : null,

      remediationTrigger:
        typeof item.remediationTrigger ===
        "string"
          ? item.remediationTrigger
          : null,

      attestationTrigger:
        typeof item.attestationTrigger ===
        "string"
          ? item.attestationTrigger
          : null,
    }));
}

function normalizeResponses(
  responses: any[],
): TruvernScoringInput[] {
  return responses.map(
    (response) => {
      const metadata =
        semanticQuestionMetadata(
          response.question.metadata,
        );

      return {
        questionId:
          response.questionId,

        controlId:
          response.question
            .control.id,

        controlCode:
          response.question
            .control.controlId,

        family:
          response.question
            .control.family,

        prompt:
          response.question.prompt,

        answer:
          response.answer,

        score:
          response.score,

        maxScore:
          response.question
            .weight ?? 1,

        weight:
          response.question
            .weight ?? 1,

        requiresEvidence:
          response.question
            .requiresEvidence,

        requiresAttestation:
          response.question
            .requiresAttestation,

        evidence:
          response.evidence,

        recommendedEvidence:
          metadata
            .recommendedEvidence ===
          true,

        parameterIds:
          stringArray(
            metadata.parameterIds,
          ),

        assessmentObjectiveIds:
          stringArray(
            metadata
              .assessmentObjectiveIds,
          ),

        assessmentMethodIds:
          stringArray(
            metadata
              .assessmentMethodIds,
          ),

        assessmentObjectIds:
          stringArray(
            metadata
              .assessmentObjectIds,
          ),

        methodTypes:
          stringArray(
            metadata.methodTypes,
          ),

        conditionalEnhancements:
          normalizeEnhancements(
            metadata
              .conditionalEnhancements,
          ),
      };
    },
  );
}

function toSeverity(severity: TruvernGeneratedFinding["severity"]) {
  if (severity === "CRITICAL") return "CRITICAL";
  if (severity === "HIGH") return "HIGH";
  if (severity === "MODERATE") return "MODERATE";
  if (severity === "LOW") return "LOW";
  return "INFO";
}

export async function POST(_request: Request, context: RouteContext) {
  try {
    const { id: rawId } = await context.params;
    const id = parseId(rawId);

    if (!id) {
      return NextResponse.json({ ok: false, error: "Invalid assessment id." }, { status: 400 });
    }

    await requireReviewerAccess();
    await requireFrameworkAssessmentAccess(id);
    const assessment = await findTruvernFrameworkAssessment({
      where: { id },
      include: {
        responses: {
          include: {
            question: {
              include: {
                control: true,
              },
            },
          },
        },
      },
    });

    if (!assessment) {
      return NextResponse.json({ ok: false, error: "Assessment not found." }, { status: 404 });
    }

    const findingsEligibleStatuses = new Set([
      "SUBMITTED",
      "IN_REVIEW",
      "REMEDIATION_REQUESTED",
      "ATTESTATION_REQUESTED",
      "READY_FOR_RELEASE",
    ]);

    if (
      !assessment.submittedAt ||
      !findingsEligibleStatuses.has(String(assessment.status))
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Findings can only be persisted after the framework assessment has been submitted for governance review.",
          assessmentStatus: assessment.status,
          submittedAt: assessment.submittedAt,
        },
        { status: 409 },
      );
    }
    const result = generateFindings(normalizeResponses(assessment.responses));

    const created = await prisma.$transaction(async (tx) => {
      await deleteTruvernAssessmentFindings({
        where: {
          assessmentId: id,
          status: "OPEN",
        },
      }, tx);

      if (result.findings.length > 0) {
        await createTruvernAssessmentFindings({
          data: result.findings.map((finding) => ({
            assessmentId: id,
            controlId: Number.isInteger(Number(finding.controlKey)) ? Number(finding.controlKey) : null,
            severity: toSeverity(finding.severity),
            status: "OPEN",
            title: finding.title,
            description: finding.description,
            recommendation: finding.recommendation,
            remediationRequired: finding.remediationRequired,
            attestationRequired: finding.attestationRequired,
            dueAt: new Date(Date.now() + finding.dueInDays * 24 * 60 * 60 * 1000),
            metadata: {
              ...finding.metadata,
              evidenceRequired: finding.evidenceRequired,
            } as Prisma.InputJsonValue,
          })),
        }, tx);
      }

      await updateTruvernFrameworkAssessment({
        where: { id },
        data: {
          score: result.score.score,
          maxScore: result.score.maxScore,
          riskLevel: result.score.riskLevel,
          status: result.remediationRequired
            ? "REMEDIATION_REQUESTED"
            : result.attestationRequired
              ? "ATTESTATION_REQUESTED"
              : "READY_FOR_RELEASE",
          readyForReleaseAt:
            !result.remediationRequired && !result.attestationRequired ? new Date() : null,
          metadata: {
            ...(assessment.metadata && typeof assessment.metadata === "object" ? assessment.metadata : {}),
            scoring: result.score,
            findingsGeneratedAt: new Date().toISOString(),
            remediationRequired: result.remediationRequired,
            attestationRequired: result.attestationRequired,
          },
        },
      }, tx);

      return findTruvernAssessmentFindings({
        where: { assessmentId: id },
        orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
      }, tx);
    });

    await writeGovernanceAuditLog({
      organizationId: assessment.organizationId,
      entityType: "TruvernFrameworkAssessment",
      entityId: id,
      action: "FRAMEWORK_FINDINGS_GENERATED",
      message: "Framework assessment findings were generated.",
      metadata: {
        findings: created.length,
        remediationRequired: result.remediationRequired,
        attestationRequired: result.attestationRequired,
        riskLevel: result.score.riskLevel,
      },
    });

    return NextResponse.json({
      ok: true,
      score: result.score,
      remediationRequired: result.remediationRequired,
      attestationRequired: result.attestationRequired,
      findings: created,
    });
  } catch (error) {
    const authError = governanceAuthErrorResponse(error);
    if (authError) return authError;

    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to generate findings." },
      { status: 500 },
    );
  }
}






