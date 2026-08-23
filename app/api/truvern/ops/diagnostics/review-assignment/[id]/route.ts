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

  const reviewRequestRows =
    assignment.reviewRequestId
      ? await prisma.$queryRaw<
          Array<Record<string, any>>
        >`
          select
            id,
            "organizationId",
            "vendorId",
            "assessmentId",
            status::text as status,
            kind,
            title,
            "createdAt",
            "updatedAt"
          from "ReviewRequest"
          where id = ${assignment.reviewRequestId}
          limit 1
        `
      : [];

  const reviewRequest =
    reviewRequestRows[0] ?? null;
  const standardAssessmentRows =
    await prisma.$queryRaw<
      Array<Record<string, any>>
    >`
      select
        a.id,
        a.title,
        a.status::text as status,
        a."vendorId",
        a."organizationId",
        a."reviewAssignmentId",
        a."submittedAt",
        a."createdAt",
        a."updatedAt",
        t.name as "templateName",
        count(aa.id)::int as "answerCount"
      from "Assessment" a
      left join "AssessmentAnswer" aa
        on aa."assessmentId" = a.id
      left join "AssessmentTemplate" t
        on t.id = a."templateId"
      where
        a."reviewAssignmentId" = ${assignmentId}
        or (
          ${reviewRequest?.assessmentId ?? null}::int is not null
          and a.id = ${reviewRequest?.assessmentId ?? null}
        )
        or a."vendorId" = ${assignment.vendorId}
      group by
        a.id,
        a.title,
        a.status,
        a."vendorId",
        a."organizationId",
        a."reviewAssignmentId",
        a."submittedAt",
        a."createdAt",
        a."updatedAt",
        t.name
      order by
        case
          when a.id = ${reviewRequest?.assessmentId ?? null}
            then 0
          when a."reviewAssignmentId" = ${assignmentId}
            then 1
          else 2
        end,
        a."submittedAt" desc nulls last,
        a.id desc
    `;
  const standardAssessmentIds =
    standardAssessmentRows
      .map((row) => Number(row.id))
      .filter((id) => Number.isFinite(id) && id > 0);

  const standardAnswerRows =
    standardAssessmentIds.length
      ? await prisma.$queryRaw<
          Array<Record<string, any>>
        >`
          select
            aa.id,
            aa."assessmentId",
            aa."questionId",
            aa.value,
            aa."valueJson",
            aa."riskImpact",
            q.text as "questionText",
            q.category as "questionCategory"
          from "AssessmentAnswer" aa
          left join "AssessmentQuestion" q
            on q.id = aa."questionId"
          where aa."assessmentId" in (
            select unnest(
              ${standardAssessmentIds}::int[]
            )
          )
          order by
            aa."assessmentId" desc,
            aa.id asc
          limit 30
        `
      : [];

  const frameworkAssessmentRows =
    await prisma.$queryRaw<
      Array<Record<string, any>>
    >`
      select
        fa.id,
        fa.status::text as status,
        fa."vendorId",
        fa."organizationId",
        fa."reviewAssignmentId",
        fa."createdAt",
        fa."updatedAt",
        count(fr.id)::int as "responseCount"
      from "TruvernFrameworkAssessment" fa
      left join "TruvernAssessmentResponse" fr
        on fr."assessmentId" = fa.id
      where fa."reviewAssignmentId" = ${assignmentId}
      group by
        fa.id,
        fa.status,
        fa."vendorId",
        fa."organizationId",
        fa."reviewAssignmentId",
        fa."createdAt",
        fa."updatedAt"
      order by fa.id desc
    `;

  const frameworkAssessmentIds =
    frameworkAssessmentRows
      .map((row) => Number(row.id))
      .filter((id) => Number.isFinite(id) && id > 0);

  const frameworkResponseRows =
    frameworkAssessmentIds.length
      ? await prisma.$queryRaw<
          Array<Record<string, any>>
        >`
          select
            fr.id,
            fr."assessmentId",
            fr."questionId",
            fr.answer,
            fr.score,
            fr.evidence
          from "TruvernAssessmentResponse" fr
          where fr."assessmentId" in (
            select unnest(
              ${frameworkAssessmentIds}::int[]
            )
          )
          order by
            fr."assessmentId" desc,
            fr.id asc
          limit 30
        `
      : [];
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

      linkage: {
        assignment: {
          id: assignment.id,
          reviewRequestId:
            assignment.reviewRequestId ?? null,
          vendorId:
            assignment.vendorId ?? null,
        },

        reviewRequest: reviewRequest
          ? {
              id: reviewRequest.id,
              organizationId:
                reviewRequest.organizationId ?? null,
              vendorId:
                reviewRequest.vendorId ?? null,
              assessmentId:
                reviewRequest.assessmentId ?? null,
              status:
                reviewRequest.status ?? null,
              kind:
                reviewRequest.kind ?? null,
              title:
                reviewRequest.title ?? null,
            }
          : null,

        resolutionCandidates:
          standardAssessmentRows.map((row) => ({
            assessmentId:
              row.id,
            reviewAssignmentId:
              row.reviewAssignmentId ?? null,
            vendorId:
              row.vendorId ?? null,
            organizationId:
              row.organizationId ?? null,
            status:
              row.status ?? null,
            templateName:
              row.templateName ?? null,
            submittedAt:
              row.submittedAt ?? null,
            answerCount:
              Number(row.answerCount ?? 0),

            matchesReviewRequestAssessment:
              Boolean(
                reviewRequest?.assessmentId &&
                Number(row.id) ===
                  Number(reviewRequest.assessmentId),
              ),

            matchesReviewAssignment:
              Number(row.reviewAssignmentId) ===
              Number(assignmentId),
          })),
      },
      assessmentSources: {
        standardAssessments:
          standardAssessmentRows.map((row) => ({
            id: row.id,
            title: row.title ?? null,
            status: row.status ?? null,
            vendorId: row.vendorId ?? null,
            organizationId:
              row.organizationId ?? null,
            reviewAssignmentId:
              row.reviewAssignmentId ?? null,
            submittedAt:
              row.submittedAt ?? null,
            templateName:
              row.templateName ?? null,
            answerCount:
              Number(row.answerCount ?? 0),
          })),

        standardAnswerSample:
          standardAnswerRows.map((row) => ({
            id: row.id,
            assessmentId:
              row.assessmentId ?? null,
            questionId:
              row.questionId ?? null,
            value:
              row.value ?? null,
            valueJson:
              row.valueJson ?? null,
            riskImpact:
              row.riskImpact ?? null,
            questionText:
              row.questionText ?? null,
            questionCategory:
              row.questionCategory ?? null,
          })),

        frameworkAssessments:
          frameworkAssessmentRows.map((row) => ({
            id: row.id,
            status: row.status ?? null,
            vendorId: row.vendorId ?? null,
            organizationId:
              row.organizationId ?? null,
            reviewAssignmentId:
              row.reviewAssignmentId ?? null,
            responseCount:
              Number(row.responseCount ?? 0),
          })),

        frameworkResponseSample:
          frameworkResponseRows.map((row) => ({
            id: row.id,
            assessmentId:
              row.assessmentId ?? null,
            questionId:
              row.questionId ?? null,
            answer:
              row.answer ?? null,
            score:
              row.score ?? null,
            evidencePresent:
              Boolean(row.evidence),
          })),
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
