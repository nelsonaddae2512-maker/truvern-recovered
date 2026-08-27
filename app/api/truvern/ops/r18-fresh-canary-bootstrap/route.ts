import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import prisma from "@/lib/prisma";
import { requireOpsAccess } from "@/lib/auth/truvern-governance";
import { findTruvernFramework } from "@/lib/repositories/truvern-framework-repository";
import { createTruvernFrameworkAssessment } from "@/lib/repositories/truvern-framework-assessment-repository";
import { createTruvernAssessmentResponses } from "@/lib/repositories/truvern-assessment-response-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const FRAMEWORK_SLUG =
  "nist-800-53-rev5";

const FRAMEWORK_VERSION =
  "5.2.0";

const CANARY_TITLE =
  "TRUVERN R18 GOVERNANCE RELEASE CANARY — DO NOT USE";

const CONFIRM =
  "CREATE-R18-FRESH-CANARY";

const EXPECTED_QUESTION_COUNT =
  301;

type RequestBody = {
  confirm?: unknown;
};

export async function POST(request: Request) {
  await requireOpsAccess();

  const body =
    (await request.json().catch(() => ({}))) as RequestBody;

  if (body.confirm !== CONFIRM) {
    return NextResponse.json(
      {
        ok: false,
        state: "EXPLICIT_CONFIRMATION_REQUIRED",
      },
      {
        status: 400,
      },
    );
  }

  const framework =
    await findTruvernFramework({
      where: {
        slug: FRAMEWORK_SLUG,
      },
      include: {
        controls: {
          include: {
            questions: {
              orderBy: [
                {
                  sortOrder: "asc",
                },
                {
                  id: "asc",
                },
              ],
            },
          },
          orderBy: [
            {
              family: "asc",
            },
            {
              sortOrder: "asc",
            },
            {
              controlId: "asc",
            },
          ],
        },
      },
    });

  if (!framework) {
    return NextResponse.json(
      {
        ok: false,
        state: "FRAMEWORK_NOT_FOUND",
      },
      {
        status: 404,
      },
    );
  }

  if (framework.version !== FRAMEWORK_VERSION) {
    return NextResponse.json(
      {
        ok: false,
        state: "FRAMEWORK_VERSION_MISMATCH",
        expectedVersion: FRAMEWORK_VERSION,
        actualVersion: framework.version,
      },
      {
        status: 409,
      },
    );
  }

  const questions =
    framework.controls.flatMap(
      (control) => control.questions,
    );

  if (questions.length !== EXPECTED_QUESTION_COUNT) {
    return NextResponse.json(
      {
        ok: false,
        state: "UNEXPECTED_QUESTION_CARDINALITY",
        expectedQuestionCount:
          EXPECTED_QUESTION_COUNT,
        actualQuestionCount:
          questions.length,
      },
      {
        status: 409,
      },
    );
  }

  const existingFreshCanary =
    await prisma.truvernFrameworkAssessment.findFirst({
      where: {
        title: CANARY_TITLE,
        frameworkId: framework.id,
        organizationId: null,
        vendorId: null,
        assessmentRunId: null,
        reviewAssignmentId: null,
        submittedAt: null,
        releasedAt: null,
        status: "DRAFT",
      },
      select: {
        id: true,
        status: true,
        createdAt: true,
        _count: {
          select: {
            responses: true,
          },
        },
      },
      orderBy: [
        {
          id: "desc",
        },
      ],
    });

  if (existingFreshCanary) {
    return NextResponse.json(
      {
        ok: false,
        state: "FRESH_CANARY_ALREADY_EXISTS",
        assessment: {
          id: existingFreshCanary.id,
          status: existingFreshCanary.status,
          responseCount:
            existingFreshCanary._count.responses,
          createdAt:
            existingFreshCanary.createdAt,
        },
      },
      {
        status: 409,
      },
    );
  }

  const created =
    await prisma.$transaction(async (tx) => {
      const assessment =
        await createTruvernFrameworkAssessment(
          {
            data: {
              frameworkId: framework.id,
              organizationId: null,
              vendorId: null,
              assessmentRunId: null,
              reviewAssignmentId: null,
              title: CANARY_TITLE,
              status: "DRAFT",
              score: null,
              maxScore: null,
              riskLevel: null,
              sentAt: null,
              submittedAt: null,
              remediationDueAt: null,
              readyForReleaseAt: null,
              releasedAt: null,
              metadata: {
                canary: true,
                canaryGeneration: "R18",
                source:
                  "r18-fresh-canary-bootstrap",
                frameworkSlug:
                  framework.slug,
                frameworkVersion:
                  framework.version,
                expectedQuestionCount:
                  EXPECTED_QUESTION_COUNT,
                syntheticProductionCanary:
                  true,
                customerVisible:
                  false,
              },
            },
            select: {
              id: true,
              title: true,
              status: true,
              frameworkId: true,
              organizationId: true,
              vendorId: true,
              assessmentRunId: true,
              reviewAssignmentId: true,
              submittedAt: true,
              readyForReleaseAt: true,
              releasedAt: true,
              createdAt: true,
            },
          },
          tx,
        );

      const responseResult =
        await createTruvernAssessmentResponses(
          {
            data: questions.map(
              (question) => ({
                assessmentId:
                  assessment.id,
                questionId:
                  question.id,
                answer: "yes",
                score: null,
                reviewerNotes: null,
                vendorNotes: "R18 isolated production release canary.",
                evidence:
                  question.requiresEvidence
                    ? ({
                        canary: true,
                        source: "R18.6AC",
                        type:
                          "synthetic-production-release-canary-evidence",
                        statement:
                          "Synthetic evidence object used only to exercise the isolated Truvern production governance release canary.",
                      } satisfies Prisma.InputJsonObject)
                    : undefined,
                metadata: {
                  prebuilt: true,
                  canary: true,
                  canaryGeneration:
                    "R18",
                  createdFromFrameworkSlug:
                    framework.slug,
                  syntheticProductionCanary:
                    true,
                  syntheticResponse:
                    true,
                },
              }),
            ),
            skipDuplicates: false,
          },
          tx,
        );

      if (
        responseResult.count !==
        EXPECTED_QUESTION_COUNT
      ) {
        throw new Error(
          `Fresh canary response initialization expected ${EXPECTED_QUESTION_COUNT} rows but created ${responseResult.count}.`,
        );
      }

      return {
        assessment,
        responsesCreated:
          responseResult.count,
      };
    });

  const certification =
    await prisma.truvernFrameworkAssessment.findUnique({
      where: {
        id: created.assessment.id,
      },
      select: {
        id: true,
        title: true,
        status: true,
        frameworkId: true,
        organizationId: true,
        vendorId: true,
        assessmentRunId: true,
        reviewAssignmentId: true,
        score: true,
        maxScore: true,
        riskLevel: true,
        sentAt: true,
        submittedAt: true,
        remediationDueAt: true,
        readyForReleaseAt: true,
        releasedAt: true,
        responses: {
          select: {
            id: true,
            answer: true,
            score: true,
            evidence: true,
            question: {
              select: {
                requiresEvidence: true,
                requiresAttestation: true,
              },
            },
          },
        },
      },
    });

  if (!certification) {
    return NextResponse.json(
      {
        ok: false,
        state: "POST_CREATE_CERTIFICATION_FAILED",
      },
      {
        status: 500,
      },
    );
  }

  const unansweredResponses =
    certification.responses.filter(
      (response) =>
        typeof response.answer !== "string" ||
        response.answer.trim().length === 0,
    ).length;

  const nonNullScores =
    certification.responses.filter(
      (response) =>
        response.score !== null,
    ).length;

  const missingRequiredEvidence =
    certification.responses.filter(
      (response) =>
        response.question.requiresEvidence &&
        (
          response.evidence === null ||
          response.evidence === undefined
        ),
    ).length;

  const isolated =
    certification.organizationId === null &&
    certification.vendorId === null &&
    certification.assessmentRunId === null &&
    certification.reviewAssignmentId === null;

  const pristineLifecycle =
    certification.status === "DRAFT" &&
    certification.sentAt === null &&
    certification.submittedAt === null &&
    certification.remediationDueAt === null &&
    certification.readyForReleaseAt === null &&
    certification.releasedAt === null;

  const pristineScoring =
    certification.score === null &&
    certification.maxScore === null &&
    certification.riskLevel === null;

  const responseContract =
    certification.responses.length ===
      EXPECTED_QUESTION_COUNT &&
    unansweredResponses === 0 &&
    missingRequiredEvidence === 0 &&
    nonNullScores === 0;

  const certified =
    certification.title === CANARY_TITLE &&
    isolated &&
    pristineLifecycle &&
    pristineScoring &&
    responseContract;

  return NextResponse.json(
    {
      ok: certified,
      state: certified
        ? "R18_FRESH_CANARY_CREATED"
        : "R18_FRESH_CANARY_CERTIFICATION_FAILED",

      assessment: {
        id: certification.id,
        title: certification.title,
        status: certification.status,
        frameworkId:
          certification.frameworkId,
        responseCount:
          certification.responses.length,
      },

      checks: {
        isolated,
        pristineLifecycle,
        pristineScoring,
        responseContract,
        unansweredResponses,
        missingRequiredEvidence,
        nonNullScores,
      },

      mutation: {
        assessmentCreated: true,
        responsesCreated:
          created.responsesCreated,
        organizationLinked: false,
        vendorLinked: false,
        assessmentRunLinked: false,
        reviewAssignmentLinked: false,
        submitted: false,
        scored: false,
        findingsGenerated: false,
        releaseInvoked: false,
        signingInvoked: false,
        creditsTouched: false,
        communicationsSent: false,
      },
    },
    {
      status: certified
        ? 201
        : 409,
    },
  );
}


