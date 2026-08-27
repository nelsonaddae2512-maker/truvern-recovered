import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import prisma from "@/lib/prisma";
import { requireOpsAccess } from "@/lib/auth/truvern-governance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const CANARY_ID = 1;

const CANARY_TITLE =
  "TRUVERN R17 GOVERNANCE RELEASE CANARY — DO NOT USE";

const FRAMEWORK_SLUG =
  "nist-800-53-rev5";

const FRAMEWORK_VERSION =
  "5.2.0";

const CONFIRM =
  "POPULATE-R17-CANARY-RESPONSES";

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

  const assessment =
    await prisma.truvernFrameworkAssessment.findUnique({
      where: {
        id: CANARY_ID,
      },
      select: {
        id: true,
        title: true,
        status: true,
        organizationId: true,
        vendorId: true,
        assessmentRunId: true,
        reviewAssignmentId: true,
        submittedAt: true,
        readyForReleaseAt: true,
        releasedAt: true,

        framework: {
          select: {
            id: true,
            slug: true,
            version: true,
          },
        },

        responses: {
          orderBy: [
            {
              questionId: "asc",
            },
          ],
          select: {
            id: true,
            questionId: true,
            answer: true,
            score: true,
            evidence: true,

            question: {
              select: {
                requiresEvidence: true,
                requiresAttestation: true,
                weight: true,
              },
            },
          },
        },
      },
    });

  if (!assessment) {
    return NextResponse.json(
      {
        ok: false,
        state: "CANARY_NOT_FOUND",
      },
      {
        status: 404,
      },
    );
  }

  const identityCertified =
    assessment.id === CANARY_ID &&
    assessment.title === CANARY_TITLE &&
    assessment.framework.slug === FRAMEWORK_SLUG &&
    assessment.framework.version === FRAMEWORK_VERSION;

  if (!identityCertified) {
    return NextResponse.json(
      {
        ok: false,
        state: "CANARY_IDENTITY_MISMATCH",
      },
      {
        status: 409,
      },
    );
  }

  const isolationCertified =
    assessment.organizationId === null &&
    assessment.vendorId === null &&
    assessment.assessmentRunId === null &&
    assessment.reviewAssignmentId === null;

  if (!isolationCertified) {
    return NextResponse.json(
      {
        ok: false,
        state: "CANARY_NOT_ISOLATED",
      },
      {
        status: 409,
      },
    );
  }

  const lifecycleCertified =
    assessment.status === "DRAFT" &&
    assessment.submittedAt === null &&
    assessment.readyForReleaseAt === null &&
    assessment.releasedAt === null;

  if (!lifecycleCertified) {
    return NextResponse.json(
      {
        ok: false,
        state: "CANARY_LIFECYCLE_NOT_PRISTINE",
        status: assessment.status,
      },
      {
        status: 409,
      },
    );
  }

  if (assessment.responses.length !== 301) {
    return NextResponse.json(
      {
        ok: false,
        state: "UNEXPECTED_RESPONSE_CARDINALITY",
        responseCount: assessment.responses.length,
      },
      {
        status: 409,
      },
    );
  }

  const alreadyPopulated =
    assessment.responses.filter(
      (response) =>
        response.answer !== null ||
        response.score !== null ||
        response.evidence !== null,
    );

  if (alreadyPopulated.length > 0) {
    return NextResponse.json(
      {
        ok: false,
        state: "CANARY_RESPONSES_NOT_PRISTINE",
        populatedCount: alreadyPopulated.length,
      },
      {
        status: 409,
      },
    );
  }

  const requiredEvidenceCount =
    assessment.responses.filter(
      (response) =>
        response.question.requiresEvidence,
    ).length;

  const requiredAttestationCount =
    assessment.responses.filter(
      (response) =>
        response.question.requiresAttestation,
    ).length;

  const mutation =
    await prisma.$transaction(async (tx) => {
      let updated = 0;
      let evidenceAttached = 0;

      for (const response of assessment.responses) {
        const evidence =
          response.question.requiresEvidence
            ? ({
                canary: true,
                source:
                  "R46G.7G-E7-M.2F-R17.9",
                type:
                  "synthetic-production-release-canary-evidence",
                statement:
                  "Synthetic evidence object used only to exercise the isolated Truvern production governance release canary.",
              } satisfies Prisma.InputJsonObject)
            : undefined;

        await tx.truvernAssessmentResponse.update({
          where: {
            id: response.id,
          },

          data: {
            answer: "yes",
            score: null,

            evidence:
              evidence === undefined
                ? undefined
                : evidence,

            vendorNotes:
              "R17 isolated production release canary.",

            metadata: {
              canary: true,
              canaryPhase:
                "R46G.7G-E7-M.2F-R17.9",
              syntheticResponse: true,
            },
          },
        });

        updated += 1;

        if (evidence) {
          evidenceAttached += 1;
        }
      }

      return {
        updated,
        evidenceAttached,
      };
    });

  const certification =
    await prisma.truvernFrameworkAssessment.findUnique({
      where: {
        id: CANARY_ID,
      },
      select: {
        id: true,
        title: true,
        status: true,
        organizationId: true,
        vendorId: true,

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
        state: "POST_MUTATION_CERTIFICATION_FAILED",
      },
      {
        status: 500,
      },
    );
  }

  const unanswered =
    certification.responses.filter(
      (response) =>
        typeof response.answer !== "string" ||
        response.answer.trim().length === 0,
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

  const nonNullScores =
    certification.responses.filter(
      (response) =>
        response.score !== null,
    ).length;

  const certified =
    certification.status === "DRAFT" &&
    certification.organizationId === null &&
    certification.vendorId === null &&
    certification.responses.length === 301 &&
    unanswered === 0 &&
    missingRequiredEvidence === 0 &&
    nonNullScores === 0;

  return NextResponse.json(
    {
      ok: certified,

      canary:
        "R46G.7G-E7-M.2F-R17.9",

      state:
        certified
          ? "CANARY_RESPONSES_POPULATED"
          : "CANARY_RESPONSE_CERTIFICATION_FAILED",

      assessment: {
        id: certification.id,
        title: certification.title,
        status: certification.status,
        responseCount:
          certification.responses.length,
      },

      questionContract: {
        requiredEvidenceCount,
        requiredAttestationCount,
      },

      mutation: {
        responsesUpdated:
          mutation.updated,

        syntheticEvidenceAttached:
          mutation.evidenceAttached,

        assessmentStatusChanged:
          false,

        submitted:
          false,

        scored:
          false,

        findingsGenerated:
          false,

        releaseInvoked:
          false,

        signingInvoked:
          false,
      },

      certification: {
        unanswered,
        missingRequiredEvidence,
        nonNullScores,
      },
    },
    {
      status:
        certified
          ? 200
          : 409,
    },
  );
}
