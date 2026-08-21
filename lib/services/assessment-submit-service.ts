import prisma from "@/lib/prisma";

export type SubmitAssessmentInput = {
  assessmentId: number;
  vendorId: number;
  token: string;
};

export type SubmittedAssessmentRecord = {
  id: number;
  organizationId: number;
  vendorId: number;
  status: string;
  submittedAt: Date | null;
  reviewReadyAt: Date | null;
  completionPercent: number;
  isVendorSubmitted: boolean;
};

export type SubmitAssessmentSuccess = {
  ok: true;
  alreadySubmitted: boolean;
  assessment: SubmittedAssessmentRecord;
  synchronizedRunCount: number;
};

export type SubmitAssessmentFailure = {
  ok: false;
  status: 400 | 404;
  error: string;
  missingQuestionIds?: number[];
  missingCount?: number;
};

export type SubmitAssessmentResult =
  | SubmitAssessmentSuccess
  | SubmitAssessmentFailure;

function isAnswered(answer: {
  value?: string | null;
  valueJson?: unknown;
} | null | undefined): boolean {
  const value =
    answer?.valueJson ?? answer?.value;

  if (
    value === null ||
    value === undefined
  ) {
    return false;
  }

  if (typeof value === "string") {
    return value.trim().length > 0;
  }

  return true;
}

export async function submitAssessment(
  input: SubmitAssessmentInput,
): Promise<SubmitAssessmentResult> {
  if (
    !Number.isInteger(input.assessmentId) ||
    input.assessmentId <= 0 ||
    !Number.isInteger(input.vendorId) ||
    input.vendorId <= 0 ||
    !input.token.trim()
  ) {
    return {
      ok: false,
      status: 400,
      error: "Invalid assessment submission payload.",
    };
  }

  return prisma.$transaction(
    async (tx): Promise<SubmitAssessmentResult> => {
      const assessment =
        await tx.assessment.findFirst({
          where: {
            id: input.assessmentId,
            vendorId: input.vendorId,
            token: input.token.trim(),
          },
          include: {
            answers: {
              select: {
                questionId: true,
                value: true,
                valueJson: true,
              },
            },
            template: {
              include: {
                sections: {
                  include: {
                    questions: {
                      select: {
                        id: true,
                        required: true,
                      },
                    },
                  },
                },
              },
            },
          },
        });

      if (!assessment) {
        return {
          ok: false,
          status: 404,
          error: "Assessment not found.",
        };
      }

      const alreadySubmitted =
        assessment.isVendorSubmitted ||
        assessment.status === "SUBMITTED" ||
        assessment.status === "REVIEW_READY";

      /*
       * Idempotent retries still repair AssessmentRun state.
       * This prevents a previously submitted Assessment from
       * remaining linked to an IN_PROGRESS AssessmentRun.
       */
      if (alreadySubmitted) {
        const effectiveCompletedAt =
          assessment.submittedAt ??
          assessment.reviewReadyAt ??
          new Date();

        const synchronizedRuns =
          await tx.assessmentRun.updateMany({
            where: {
              assessmentId: assessment.id,
              OR: [
                {
                  status: {
                    not: "SUBMITTED",
                  },
                },
                {
                  completedAt: null,
                },
              ],
            },
            data: {
              status: "SUBMITTED",
              completedAt: effectiveCompletedAt,
            },
          });

        return {
          ok: true,
          alreadySubmitted: true,
          synchronizedRunCount:
            synchronizedRuns.count,
          assessment: {
            id: assessment.id,
            organizationId:
              assessment.organizationId,
            vendorId: assessment.vendorId,
            status: assessment.status,
            submittedAt:
              assessment.submittedAt,
            reviewReadyAt:
              assessment.reviewReadyAt,
            completionPercent:
              assessment.completionPercent,
            isVendorSubmitted:
              assessment.isVendorSubmitted,
          },
        };
      }

      const answerMap =
        new Map<
          number,
          {
            value: string | null;
            valueJson: unknown;
          }
        >();

      for (const answer of assessment.answers) {
        answerMap.set(
          Number(answer.questionId),
          {
            value: answer.value,
            valueJson: answer.valueJson,
          },
        );
      }

      const questions =
        assessment.template?.sections.flatMap(
          (section) => section.questions,
        ) ?? [];

      const requiredQuestions =
        questions.filter(
          (question) => question.required,
        );

      const missingRequired =
        requiredQuestions.filter(
          (question) =>
            !isAnswered(
              answerMap.get(question.id),
            ),
        );

      if (missingRequired.length > 0) {
        return {
          ok: false,
          status: 400,
          error:
            "Required questions are missing.",
          missingQuestionIds:
            missingRequired.map(
              (question) => question.id,
            ),
          missingCount:
            missingRequired.length,
        };
      }

      const totalQuestions =
        questions.length;

      const answeredCount =
        totalQuestions > 0
          ? questions.filter((question) =>
              isAnswered(
                answerMap.get(question.id),
              ),
            ).length
          : 0;

      const completionPercent =
        totalQuestions > 0
          ? Math.min(
              100,
              Math.round(
                (answeredCount /
                  totalQuestions) *
                  100,
              ),
            )
          : 100;

      const now = new Date();

      const updatedAssessment =
        await tx.assessment.update({
          where: {
            id: assessment.id,
          },
          data: {
            status: "SUBMITTED",
            isVendorSubmitted: true,
            submittedAt: now,
            reviewReadyAt: now,
            completionPercent,
          },
          select: {
            id: true,
            organizationId: true,
            vendorId: true,
            status: true,
            submittedAt: true,
            reviewReadyAt: true,
            completionPercent: true,
            isVendorSubmitted: true,
          },
        });

      const synchronizedRuns =
        await tx.assessmentRun.updateMany({
          where: {
            assessmentId: assessment.id,
          },
          data: {
            status: "SUBMITTED",
            completedAt: now,
          },
        });

      return {
        ok: true,
        alreadySubmitted: false,
        synchronizedRunCount:
          synchronizedRuns.count,
        assessment: {
          ...updatedAssessment,
          status: String(
            updatedAssessment.status,
          ),
        },
      };
    },
  );
}