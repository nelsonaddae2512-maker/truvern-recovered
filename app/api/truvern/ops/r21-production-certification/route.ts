import { requireOpsAccess } from "@/lib/auth/truvern-governance";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const ASSIGNMENT_ID = 28;
const REVIEW_REQUEST_ID = 28;
const ASSESSMENT_ID = 20;

export async function GET() {
  const access = await requireOpsAccess();

  if (access instanceof Response) {
    return access;
  }

  const [
    assignment,
    reviewRequest,
    assessment,
    answers,
    responses,
  ] = await Promise.all([
    prisma.reviewAssignment.findUnique({
      where: {
        id: ASSIGNMENT_ID,
      },
    }),

    prisma.reviewRequest.findUnique({
      where: {
        id: REVIEW_REQUEST_ID,
      },
    }),

    prisma.assessment.findUnique({
      where: {
        id: ASSESSMENT_ID,
      },
    }),

    prisma.assessmentAnswer.findMany({
      where: {
        assessmentId: ASSESSMENT_ID,
      },
      orderBy: {
        id: "asc",
      },
      include: {
        question: true,
      },
    }),

    prisma.reviewResponse.findMany({
      where: {
        reviewAssignmentId: ASSIGNMENT_ID,
      },
      orderBy: {
        id: "asc",
      },
    }),
  ]);

  const projectedResponses = responses.map((response) => {
    const payload =
      response.responses &&
      typeof response.responses === "object" &&
      !Array.isArray(response.responses)
        ? response.responses
        : {};

    const findings =
      Array.isArray(payload.findings)
        ? payload.findings
        : [];

    const followUps =
      Array.isArray(payload.conditionsAndFollowUps)
        ? payload.conditionsAndFollowUps
        : [];

    const serialized =
      JSON.stringify(payload);

    return {
      id: response.id,
      organizationId: response.organizationId,
      reviewRequestId: response.reviewRequestId,
      reviewAssignmentId: response.reviewAssignmentId,
      draftSavedAt: response.draftSavedAt,
      submittedAt: response.submittedAt,

      intelligenceInput:
        payload.intelligenceInput ?? null,

      reviewerIntelligence:
        payload.truvernReviewerIntelligence ?? null,

      canonicalGovernanceArtifact:
        payload.canonicalGovernanceArtifact ?? null,

      findings: findings.map((finding) => ({
        title:
          finding &&
          typeof finding === "object" &&
          !Array.isArray(finding)
            ? finding.title ??
              finding.label ??
              null
            : null,

        severity:
          finding &&
          typeof finding === "object" &&
          !Array.isArray(finding)
            ? finding.severity ?? null
            : null,

        controlId:
          finding &&
          typeof finding === "object" &&
          !Array.isArray(finding)
            ? finding.controlId ?? null
            : null,

        controlCode:
          finding &&
          typeof finding === "object" &&
          !Array.isArray(finding)
            ? finding.controlCode ?? null
            : null,

        controlKey:
          finding &&
          typeof finding === "object" &&
          !Array.isArray(finding)
            ? finding.controlKey ?? null
            : null,

        questionId:
          finding &&
          typeof finding === "object" &&
          !Array.isArray(finding)
            ? finding.questionId ?? null
            : null,
      })),

      followUps,

      findingCount: findings.length,
      followUpCount: followUps.length,

      legacyUnmappedFindingPresent:
        serialized.includes(
          "unmapped control gap detected",
        ),

      topLevelKeys:
        Object.keys(payload).sort(),
    };
  });

  return Response.json({
    certification: {
      name:
        "R21.77 production findings persistence",
      readOnly: true,
      assignmentId: ASSIGNMENT_ID,
      reviewRequestId: REVIEW_REQUEST_ID,
      assessmentId: ASSESSMENT_ID,
    },

    assignment: assignment
      ? {
          id: assignment.id,
          status: assignment.status,
          riskLevel: assignment.riskLevel,
          decision: assignment.decision,
          reviewRequestId:
            assignment.reviewRequestId,
        }
      : null,

    reviewRequest: reviewRequest
      ? {
          id: reviewRequest.id,
          organizationId:
            reviewRequest.organizationId,
          vendorId:
            reviewRequest.vendorId,
          assessmentId:
            reviewRequest.assessmentId,
          status:
            reviewRequest.status,
        }
      : null,

    assessment: assessment
      ? {
          id: assessment.id,
          title: assessment.title,
          status: assessment.status,
          reviewAssignmentId:
            assessment.reviewAssignmentId,
        }
      : null,

    answers: answers.map((row) => ({
      answerId: row.id,
      questionId: row.questionId,
      prompt:
        row.question?.text ?? null,
      answer: row.valueJson ?? row.value,
    })),

    responses:
      projectedResponses,

    assertions: {
      assignmentFound:
        assignment?.id === ASSIGNMENT_ID,

      reviewRequestFound:
        reviewRequest?.id === REVIEW_REQUEST_ID,

      assessmentFound:
        assessment?.id === ASSESSMENT_ID,

      assessmentAnswerCount:
        answers.length,

      reviewResponseCount:
        responses.length,

      persistedRisk:
        assignment?.riskLevel ?? null,

      persistedDecision:
        assignment?.decision ?? null,

      responseSubmitted:
        responses.length === 1
          ? responses[0].submittedAt !== null
          : null,

      findingCount:
        projectedResponses.length === 1
          ? projectedResponses[0].findingCount
          : null,

      followUpCount:
        projectedResponses.length === 1
          ? projectedResponses[0].followUpCount
          : null,

      legacyUnmappedFindingPresent:
        projectedResponses.some(
          (response) =>
            response.legacyUnmappedFindingPresent,
        ),
    },
  });
}