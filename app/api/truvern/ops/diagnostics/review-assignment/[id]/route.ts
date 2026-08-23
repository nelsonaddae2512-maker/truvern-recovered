import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { isTruvernOperator } from "@/lib/truvern-ops-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = {
  params: Promise<{ id: string }> | { id: string };
};

function safeInt(value: unknown) {
  const n = Number(String(value ?? "").trim());
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

function objectValue(value: unknown): Record<string, any> {
  return value &&
    typeof value === "object" &&
    !Array.isArray(value)
    ? (value as Record<string, any>)
    : {};
}

function arrayValue(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}

function stringValue(value: unknown) {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function findingSummary(value: unknown) {
  const findings = arrayValue(value);

  return {
    count: findings.length,

    remediationRequiredCount:
      findings.filter(
        (finding) =>
          objectValue(finding).remediationRequired === true,
      ).length,

    attestationRequiredCount:
      findings.filter(
        (finding) =>
          objectValue(finding).attestationRequired === true,
      ).length,

    requiredEvidenceCount:
      findings.reduce(
        (total, finding) =>
          total +
          arrayValue(
            objectValue(finding).requiredEvidence,
          ).length,
        0,
      ),

    requiredAttestationCount:
      findings.reduce(
        (total, finding) =>
          total +
          arrayValue(
            objectValue(finding).requiredAttestation,
          ).length,
        0,
      ),

    severities:
      findings.map((finding) =>
        stringValue(
          objectValue(finding).severity,
        ).toUpperCase(),
      ),
  };
}

export async function GET(
  _request: Request,
  props: Props,
) {
  const authorized =
    await isTruvernOperator();

  if (!authorized) {
    return NextResponse.json(
      {
        error: "Not authorized.",
      },
      {
        status: 403,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }

  const resolved =
    await props.params;

  const assignmentId =
    safeInt(resolved.id);

  if (!assignmentId) {
    return NextResponse.json(
      {
        error: "Invalid assignment id.",
      },
      {
        status: 400,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }

  const assignmentRows =
    await prisma.$queryRaw<
      Array<Record<string, any>>
    >`
      select
        id,
        "reviewRequestId",
        "vendorId",
        status::text as status,
        "riskLevel"::text as "riskLevel",
        decision::text as decision,
        "createdAt",
        "updatedAt"
      from "ReviewAssignment"
      where id = ${assignmentId}
      limit 1
    `;

  const assignment =
    assignmentRows[0] ?? null;

  if (!assignment) {
    return NextResponse.json(
      {
        assignmentId,
        found: false,
      },
      {
        status: 404,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }

  const responseRows =
    await prisma.$queryRaw<
      Array<Record<string, any>>
    >`
      select
        id,
        "reviewAssignmentId",
        "reviewRequestId",
        "organizationId",
        responses,
        "createdAt",
        "updatedAt",
        "draftSavedAt",
        "submittedAt"
      from "ReviewResponse"
      where "reviewAssignmentId" = ${assignmentId}
      order by "updatedAt" desc
      limit 1
    `;

  const response =
    responseRows[0] ?? null;

  const payload =
    objectValue(response?.responses);

  const reviewer =
    objectValue(
      payload.truvernReviewerIntelligence,
    );

  const canonical =
    objectValue(
      payload.canonicalGovernanceArtifact,
    );

  const scoringCandidates = {
    answers:
      arrayValue(payload.answers).length,

    responses:
      arrayValue(payload.responses).length,

    vendorAnswers:
      arrayValue(payload.vendorAnswers).length,

    questionnaireResponses:
      arrayValue(
        payload.questionnaireResponses,
      ).length,

    assessmentResponses:
      arrayValue(
        payload.assessmentResponses,
      ).length,

    submittedAnswers:
      arrayValue(
        payload.submittedAnswers,
      ).length,

    items:
      arrayValue(payload.items).length,
  };

  return NextResponse.json(
    {
      assignmentId,
      found: true,

      assignment: {
        id: assignment.id,
        reviewRequestId:
          assignment.reviewRequestId ??
          null,
        vendorId:
          assignment.vendorId ?? null,
        status:
          assignment.status ?? null,
        riskLevel:
          assignment.riskLevel ?? null,
        decision:
          assignment.decision ?? null,
        createdAt:
          assignment.createdAt ?? null,
        updatedAt:
          assignment.updatedAt ?? null,
      },

      latestReviewResponse: response
        ? {
            found: true,
            id: response.id,
            reviewAssignmentId:
              response.reviewAssignmentId,
            reviewRequestId:
              response.reviewRequestId ??
              null,
            organizationId:
              response.organizationId ??
              null,
            createdAt:
              response.createdAt ?? null,
            updatedAt:
              response.updatedAt ?? null,
            draftSavedAt:
              response.draftSavedAt ?? null,
            submittedAt:
              response.submittedAt ?? null,

            topLevelKeys:
              Object.keys(payload),

            scoringCandidates,

            legacy: {
              riskLevel:
                payload.riskLevel ?? null,
              decision:
                payload.decision ?? null,
              findings:
                findingSummary(
                  payload.findings,
                ),
              conditionsAndFollowUps:
                arrayValue(
                  payload.conditionsAndFollowUps,
                ).length,
            },

            reviewerIntelligence: {
              present:
                Object.keys(reviewer).length > 0,
              riskLevel:
                objectValue(
                  reviewer.score,
                ).riskLevel ?? null,
              recommendation:
                reviewer.recommendation ??
                null,
              remediationRequired:
                reviewer.remediationRequired ??
                null,
              attestationRequired:
                reviewer.attestationRequired ??
                null,
              findings:
                findingSummary(
                  reviewer.findings,
                ),
              followUps:
                arrayValue(
                  reviewer.followUps,
                ).length,
            },

            canonicalGovernanceArtifact: {
              present:
                Object.keys(canonical).length > 0,
              riskLevel:
                canonical.riskLevel ?? null,
              decision:
                canonical.decision ?? null,
              remediationRequired:
                canonical.remediationRequired ??
                null,
              attestationRequired:
                canonical.attestationRequired ??
                null,
              findings:
                findingSummary(
                  canonical.findings,
                ),
              conditionsAndFollowUps:
                arrayValue(
                  canonical.conditionsAndFollowUps,
                ).length,
            },
          }
        : {
            found: false,
          },
    },
    {
      headers: {
        "Cache-Control":
          "no-store, no-cache, must-revalidate",
      },
    },
  );
}
