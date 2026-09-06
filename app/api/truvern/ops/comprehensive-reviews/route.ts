import { NextResponse } from "next/server";
import { requireOpsAccess } from "@/lib/auth/truvern-governance";
import prisma from "@/lib/prisma";
import { acquireReviewAssignmentAdvisoryLock } from "@/lib/repositories/review-assignment-lock-repository";
import { createTruvernFrameworkAssessment } from "@/lib/repositories/truvern-framework-assessment-repository";
import { createTruvernAssessmentResponses } from "@/lib/repositories/truvern-assessment-response-repository";
import { reserveReviewCredits } from "@/lib/services/review-credit-ledger-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const CANONICAL_FRAMEWORK_SLUG =
  "nist-800-53-rev5";

const EXPECTED_CANONICAL_QUESTION_COUNT =
  301;


function comprehensiveReviewCreditCost(): number {
  const configured =
    Number(
      process.env.TRUVERN_REVIEW_CREDIT_COST ??
        1,
    );

  if (
    !Number.isFinite(configured) ||
    configured <= 0
  ) {
    return 1;
  }

  return Math.floor(configured);
}

class ComprehensiveReviewCreditError extends Error {
  readonly requiredCredits: number;
  readonly availableCredits: number;

  constructor(
    requiredCredits: number,
    availableCredits: number,
  ) {
    super(
      "Comprehensive Truvern Review requires available Truvern credits.",
    );

    this.name =
      "ComprehensiveReviewCreditError";

    this.requiredCredits =
      requiredCredits;

    this.availableCredits =
      availableCredits;
  }
}
type ExistingRow = {
  assignmentId: number;
  assessmentId: number;
};

function positiveInt(
  value: unknown,
): number | null {
  const parsed =
    typeof value === "number"
      ? value
      : Number(value);

  return Number.isInteger(parsed) &&
    parsed > 0
    ? parsed
    : null;
}

export async function POST(
  request: Request,
) {
  try {
    const actor =
      await requireOpsAccess();

    const body =
      await request
        .json()
        .catch(() => null);

    const vendorId =
      positiveInt(body?.vendorId);

    if (!vendorId) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "A valid vendorId is required.",
        },
        {
          status: 400,
        },
      );
    }

    const vendor =
      await prisma.vendor.findUnique({
        where: {
          id: vendorId,
        },
        select: {
          id: true,
          name: true,
          organizationId: true,
        },
      });

    if (!vendor) {
      return NextResponse.json(
        {
          ok: false,
          error: "Vendor not found.",
        },
        {
          status: 404,
        },
      );
    }

    const framework =
      await prisma.truvernFramework.findUnique({
        where: {
          slug:
            CANONICAL_FRAMEWORK_SLUG,
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
          error:
            "Certified canonical NIST framework was not found.",
        },
        {
          status: 404,
        },
      );
    }

    const questions =
      framework.controls.flatMap(
        (control) =>
          control.questions,
      );

    if (
      questions.length !==
      EXPECTED_CANONICAL_QUESTION_COUNT
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Canonical NIST question-count certification failed.",
          expectedQuestionCount:
            EXPECTED_CANONICAL_QUESTION_COUNT,
          actualQuestionCount:
            questions.length,
        },
        {
          status: 409,
        },
      );
    }

    const result =
      await prisma.$transaction(
        async (tx) => {
          await acquireReviewAssignmentAdvisoryLock(
            tx,
            {
              organizationId:
                vendor.organizationId,
              vendorId:
                vendor.id,
            },
          );

          const existing =
            await tx.$queryRaw<
              ExistingRow[]
            >`
              select
                ra.id as "assignmentId",
                tfa.id as "assessmentId"
              from "ReviewAssignment" ra
              join "ReviewRequest" rr
                on rr.id =
                   ra."reviewRequestId"
              join "TruvernFrameworkAssessment" tfa
                on tfa."reviewAssignmentId" =
                   ra.id
              where
                ra."organizationId" =
                  ${vendor.organizationId}
                and ra."vendorId" =
                  ${vendor.id}
                and ra."assignmentType"::text =
                  'TRUVERN'
                and ra.status::text in (
                  'PENDING',
                  'IN_PROGRESS'
                )
                and tfa."frameworkId" =
                  ${framework.id}
              order by
                ra."updatedAt" desc,
                ra.id desc
              limit 1
            `;

          if (
            existing[0]?.assignmentId &&
            existing[0]?.assessmentId
          ) {
            return {
              alreadyExists: true,
              assignmentId:
                existing[0]
                  .assignmentId,
              assessmentId:
                existing[0]
                  .assessmentId,
            };
          }

          const reviewRequests =
            await tx.$queryRaw<
              Array<{
                id: number;
              }>
            >`
              insert into "ReviewRequest" (
                "organizationId",
                "vendorId",
                "assessmentId",
                title,
                note,
                status,
                "updatedAt"
              )
              values (
                ${vendor.organizationId},
                ${vendor.id},
                ${null},
                ${`Comprehensive NIST Review - ${vendor.name}`},
                ${"Truvern Ops comprehensive canonical NIST SP 800-53 review."},
                'REQUESTED'::text,
                now()
              )
              returning id
            `;

          const reviewRequest =
            reviewRequests[0];

          if (!reviewRequest?.id) {
            throw new Error(
              "Failed to create comprehensive review request.",
            );
          }

          const assignments =
            await tx.$queryRaw<
              Array<{
                id: number;
              }>
            >`
              insert into "ReviewAssignment" (
                "organizationId",
                "vendorId",
                "reviewRequestId",
                "assignmentType",
                "status",
                "note",
                "reviewerName",
                "assignedReviewerName",
                "assignedTo",
                "updatedAt"
              )
              values (
                ${vendor.organizationId},
                ${vendor.id},
                ${reviewRequest.id},
                'TRUVERN'::text,
                'PENDING'::text,
                ${"Comprehensive canonical NIST review requested from Truvern Ops Library."},
                ${"Truvern Review Team"},
                ${"Truvern Review Team"},
                ${"Truvern Review Team"},
                now()
              )
              returning id
            `;

          const assignment =
            assignments[0];

          if (!assignment?.id) {
            throw new Error(
              "Failed to create comprehensive review assignment.",
            );
          }
          const creditCost =
            comprehensiveReviewCreditCost();

          const creditReservation =
            await reserveReviewCredits(
              tx,
              {
                organizationId:
                  vendor.organizationId,
                assignmentId:
                  assignment.id,
                reviewRequestId:
                  reviewRequest.id,
                vendorId:
                  vendor.id,
                actorUserId:
                  actor.userId ?? null,
                cost:
                  creditCost,
                source:
                  "truvern_ops_comprehensive_review",
                eventKey:
                  `review:${assignment.id}:reservation`,
                note:
                  `Reserved ${creditCost} Truvern credit${
                    creditCost === 1 ? "" : "s"
                  } for comprehensive NIST review.`,
                metadata: {
                  comprehensiveNist:
                    true,
                  frameworkSlug:
                    framework.slug,
                  frameworkVersion:
                    framework.version,
                  questionCount:
                    questions.length,
                  requestedBySource:
                    "truvern-ops-library",
                },
              },
            );

          if (!creditReservation.ok) {
            throw new ComprehensiveReviewCreditError(
              creditReservation.requiredCredits,
              creditReservation.availableCredits,
            );
          }
          const dueAt =
            new Date(
              Date.now() +
                14 *
                  24 *
                  60 *
                  60 *
                  1000,
            );

          const assessment =
            await createTruvernFrameworkAssessment(
              {
                data: {
                  frameworkId:
                    framework.id,
                  organizationId:
                    vendor.organizationId,
                  vendorId:
                    vendor.id,
                  assessmentRunId:
                    null,
                  reviewAssignmentId:
                    assignment.id,
                  title:
                    `Comprehensive NIST SP 800-53 Review - ${vendor.name}`,
                  status:
                    "DRAFT",
                  metadata: {
                    source:
                      "truvern-ops-comprehensive-review",
                    frameworkSlug:
                      framework.slug,
                    frameworkVersion:
                      framework.version,
                    controlCount:
                      framework.controls.length,
                    questionCount:
                      questions.length,
                    requestedBy:
                      actor.userId,
                    requestedBySource:
                      "truvern-ops-library",
                    comprehensiveNist:
                      true,
                    managedReviewDueAt:
                      dueAt.toISOString(),
                    managedReviewDueDays:
                      14,
                  },
                },
              },
              tx,
            );

          await createTruvernAssessmentResponses(
            {
              data:
                questions.map(
                  (question) => ({
                    assessmentId:
                      assessment.id,
                    questionId:
                      question.id,
                    answer:
                      undefined,
                    score:
                      null,
                    evidence:
                      undefined,
                    metadata: {
                      prebuilt:
                        true,
                      comprehensiveNist:
                        true,
                      createdFromFrameworkSlug:
                        framework.slug,
                    },
                  }),
                ),
              skipDuplicates:
                true,
            },
            tx,
          );

          return {
            alreadyExists:
              false,
            assignmentId:
              assignment.id,
            assessmentId:
              assessment.id,
            creditReservation: {
              reservedCredits:
                creditReservation.reservedCredits,
              eventKey:
                creditReservation.eventKey,
              reused:
                creditReservation.reused,
            },
          };
        },
      );

    return NextResponse.json({
      ok: true,
      ...result,
      vendorId:
        vendor.id,
      vendorName:
        vendor.name,
      frameworkSlug:
        framework.slug,
      questionCount:
        questions.length,
      reviewDeskUrl:
        `/review-desk/${result.assignmentId}`,
      vendorWorkspaceAvailable:
        false,
    });
  } catch (error) {
    if (
      error instanceof
        ComprehensiveReviewCreditError
    ) {
      return NextResponse.json(
        {
          ok: false,
          code:
            "TRUVERN_CREDITS_REQUIRED",
          error:
            error.message,
          requiredCredits:
            error.requiredCredits,
          availableCredits:
            error.availableCredits,
          fundingUrl:
            "/billing/credits",
        },
        {
          status: 402,
        },
      );
    }

    console.error(
      "TRUVERN_COMPREHENSIVE_REVIEW_CREATE_ERROR",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to create comprehensive review.",
      },
      {
        status: 500,
      },
    );
  }
}