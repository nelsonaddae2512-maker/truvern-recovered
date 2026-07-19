import { currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { governanceAuthErrorResponse } from "@/lib/auth/governance-auth-errors";
import prisma from "@/lib/prisma";
import { requireReviewerAccess } from "@/lib/auth/truvern-governance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function safeString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function safeNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isInteger(parsed) && parsed > 0) return parsed;
  }
  return null;
}

function frameworkWhere(value: unknown) {
  const id = safeNumber(value);
  if (id) return { id };

  const slug = safeString(value);
  if (slug) return { slug };

  return null;
}

export async function POST(request: Request) {
  try {
    await requireReviewerAccess();

    const user = await currentUser();
    const requesterName =
      user?.fullName ||
      user?.firstName ||
      user?.primaryEmailAddress?.emailAddress ||
      "requesting customer";

    const requesterEmail =
      user?.primaryEmailAddress?.emailAddress || null;

    const body = await request.json().catch(() => ({}));

    const frameworkLookup = frameworkWhere(body.frameworkId ?? body.frameworkSlug ?? body.framework);
    const organizationId = safeNumber(body.organizationId);
    const vendorId = safeNumber(body.vendorId);
    const assessmentRunId = safeNumber(body.assessmentRunId);
    const reviewAssignmentId = safeNumber(body.reviewAssignmentId);
    const managedReviewDueAt = reviewAssignmentId
      ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
      : null;

    if (!frameworkLookup) {
      return NextResponse.json(
        { ok: false, error: "frameworkId or frameworkSlug is required." },
        { status: 400 },
      );
    }

    const framework = await prisma.truvernFramework.findUnique({
      where: frameworkLookup,
      include: {
        controls: {
          include: {
            questions: {
              orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
            },
          },
          orderBy: [{ family: "asc" }, { sortOrder: "asc" }, { controlId: "asc" }],
        },
      },
    });

    if (!framework) {
      return NextResponse.json({ ok: false, error: "Framework not found." }, { status: 404 });
    }

    const title =
      safeString(body.title) ??
      `${framework.name}${vendorId ? ` vendor review #${vendorId}` : " assessment"}`;

    const assessment = await prisma.$transaction(async (tx) => {
      const created = await tx.truvernFrameworkAssessment.create({
        data: {
          frameworkId: framework.id,
          organizationId,
          vendorId,
          assessmentRunId,
          reviewAssignmentId,
          title,
          status: "DRAFT",
          metadata: {
            source: "truvern-framework-assessment-api",
            frameworkSlug: framework.slug,
            frameworkVersion: framework.version,
            controlCount: framework.controls.length,
            questionCount: framework.controls.reduce((sum, control) => sum + control.questions.length, 0),
            requestedBy: requesterName,
            requestedByEmail: requesterEmail,
            requestedBySource: safeString(body.requestedBy),
            managedReviewDueAt: managedReviewDueAt
              ? managedReviewDueAt.toISOString()
              : null,
            managedReviewDueDays: reviewAssignmentId ? 14 : null,
          },
        },
      });

      const questions = framework.controls.flatMap((control) => control.questions);

      if (questions.length > 0) {
        await tx.truvernAssessmentResponse.createMany({
          data: questions.map((question) => ({
            assessmentId: created.id,
            questionId: question.id,
            answer: undefined,
            score: null,
            evidence: undefined,
            metadata: {
              prebuilt: true,
              createdFromFrameworkSlug: framework.slug,
            },
          })),
          skipDuplicates: true,
        });
      }

      return tx.truvernFrameworkAssessment.findUniqueOrThrow({
        where: { id: created.id },
        include: {
          framework: {
            select: {
              id: true,
              slug: true,
              name: true,
              version: true,
            },
          },
          responses: {
            include: {
              question: {
                include: {
                  control: {
                    select: {
                      id: true,
                      controlId: true,
                      family: true,
                      title: true,
                    },
                  },
                },
              },
            },
            orderBy: [{ questionId: "asc" }],
          },
        },
      });
    });

    return NextResponse.json(
      {
        ok: true,
        assessment,
        counts: {
          responses: assessment.responses.length,
          controls: new Set(assessment.responses.map((response) => response.question.control.id)).size,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    const authError = governanceAuthErrorResponse(error);
    if (authError) return authError;

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to create framework assessment.",
      },
      { status: 500 },
    );
  }
}







