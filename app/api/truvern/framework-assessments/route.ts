import { currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import {
  governanceAuthErrorResponse,
  governanceForbidden,
} from "@/lib/auth/governance-auth-errors";
import prisma from "@/lib/prisma";
import {
  requireReviewerAccess,
  requireReviewAssignmentAccess,
} from "@/lib/auth/truvern-governance";
import { findTruvernFramework } from "@/lib/repositories/truvern-framework-repository";
import { createTruvernFrameworkAssessment } from "@/lib/repositories/truvern-framework-assessment-repository";
import { requireTruvernFrameworkAssessment } from "@/lib/repositories/truvern-framework-assessment-repository";
import { createTruvernAssessmentResponses } from "@/lib/repositories/truvern-assessment-response-repository";
import { findFirstAssessmentRun } from "@/lib/repositories/assessment-run-repository";

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
    const requestedOrganizationId = safeNumber(body.organizationId);
    const requestedVendorId = safeNumber(body.vendorId);
    const assessmentRunId = safeNumber(body.assessmentRunId);
    const reviewAssignmentId = safeNumber(body.reviewAssignmentId);

    let organizationId = requestedOrganizationId;
    let vendorId = requestedVendorId;

    if (reviewAssignmentId) {
      const { assignment } =
        await requireReviewAssignmentAccess(reviewAssignmentId);

      if (
        requestedOrganizationId != null &&
        requestedOrganizationId !== assignment.organizationId
      ) {
        throw governanceForbidden(
          "Requested organization does not match the review assignment.",
        );
      }

      if (
        requestedVendorId != null &&
        requestedVendorId !== assignment.vendorId
      ) {
        throw governanceForbidden(
          "Requested vendor does not match the review assignment.",
        );
      }

      organizationId = assignment.organizationId;
      vendorId = assignment.vendorId;
    }

    if (assessmentRunId) {
      const assessmentRun =
        await findFirstAssessmentRun({
          where: {
            id: assessmentRunId,
          },
          select: {
            id: true,
            organizationId: true,
            vendorId: true,
          },
        });

      if (!assessmentRun) {
        throw governanceForbidden(
          "Assessment run not found.",
        );
      }

      if (
        organizationId != null &&
        assessmentRun.organizationId !== organizationId
      ) {
        throw governanceForbidden(
          "Assessment run organization does not match the framework assessment.",
        );
      }

      if (
        vendorId != null &&
        assessmentRun.vendorId != null &&
        assessmentRun.vendorId !== vendorId
      ) {
        throw governanceForbidden(
          "Assessment run vendor does not match the framework assessment.",
        );
      }

      if (organizationId == null) {
        organizationId = assessmentRun.organizationId;
      }

      if (
        vendorId == null &&
        assessmentRun.vendorId != null
      ) {
        vendorId = assessmentRun.vendorId;
      }
    }

    const managedReviewDueAt = reviewAssignmentId
      ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
      : null;

    if (!frameworkLookup) {
      return NextResponse.json(
        { ok: false, error: "frameworkId or frameworkSlug is required." },
        { status: 400 },
      );
    }

    const framework = await findTruvernFramework({
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
      const created = await createTruvernFrameworkAssessment({
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
      }, tx);

      const questions = framework.controls.flatMap((control) => control.questions);

      if (questions.length > 0) {
        await createTruvernAssessmentResponses({
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
        }, tx);
      }

      return requireTruvernFrameworkAssessment({
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
      }, tx);
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







