import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createOrgNotification } from "@/lib/notifications/create-notification";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function isAnswered(answer: any) {
  const value = answer?.valueJson ?? answer?.value;

  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;

  return true;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);

    const assessmentId = Number(body?.assessmentId);
    const vendorId = Number(body?.vendorId);
    const token = String(body?.token || "").trim();

    if (!Number.isFinite(assessmentId) || !Number.isFinite(vendorId) || !token) {
      return NextResponse.json(
        { ok: false, error: "Invalid payload." },
        { status: 400 },
      );
    }

    const assessment = await prisma.assessment.findFirst({
      where: {
        id: assessmentId,
        vendorId,
        token,
      },
      include: {
        answers: true,
        template: {
          include: {
            sections: {
              include: {
                questions: true,
              },
            },
          },
        },
      },
    });

    if (!assessment) {
      return NextResponse.json(
        { ok: false, error: "Assessment not found." },
        { status: 404 },
      );
    }

    if (assessment.isVendorSubmitted || assessment.status === "SUBMITTED" || assessment.status === "REVIEW_READY") {
          await createOrgNotification({
      organizationId: assessment.organizationId,
      type: "VENDOR_SUBMITTED",
      severity: "INFO",
      title: `Vendor review submitted - Vendor #${assessment.vendorId || "unknown"}`,
      message: "A vendor completed and submitted an assessment for governance review.",
      href: "/review-desk",
      metadataJson: {
        assessmentId: assessment.id,
        vendorId: assessment.vendorId,
        source: "vendor_portal",
      },
    });
return NextResponse.json({
        ok: true,
        alreadySubmitted: true,
        status: assessment.status,
      });
    }

    const answerMap = new Map<number, any>();

    for (const answer of assessment.answers || []) {
      answerMap.set(Number(answer.questionId), answer);
    }

    const requiredQuestions =
      assessment.template?.sections.flatMap((section) =>
        section.questions.filter((question) => question.required),
      ) || [];

    const missingRequired = requiredQuestions.filter((question) => {
      return !isAnswered(answerMap.get(question.id));
    });

    if (missingRequired.length > 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "Required questions are missing.",
          missingQuestionIds: missingRequired.map((question) => question.id),
          missingCount: missingRequired.length,
        },
        { status: 400 },
      );
    }

    const totalQuestions =
      assessment.template?.sections.reduce(
        (sum, section) => sum + section.questions.length,
        0,
      ) || 0;

    const answeredCount =
      totalQuestions > 0
        ? (assessment.answers || []).filter(isAnswered).length
        : 0;

    const completionPercent =
      totalQuestions > 0
        ? Math.min(100, Math.round((answeredCount / totalQuestions) * 100))
        : 100;

    const updated = await prisma.assessment.update({
      where: {
        id: assessment.id,
      },
      data: {
        status: "SUBMITTED",
        isVendorSubmitted: true,
        submittedAt: new Date(),
        reviewReadyAt: new Date(),
        completionPercent,
      } as any,
      select: {
        id: true,
        status: true,
        submittedAt: true,
        completionPercent: true,
      },
    });

    try {
      await fetch(
        `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/truvern/framework-assessments/${assessment.id}/score`,
        {
          method: "POST",
        }
      );
    } catch (error) {
      console.error("Failed to score assessment", error);
    }

    return NextResponse.json({
      ok: true,
      assessment: updated,
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to submit assessment." },
      { status: 500 },
    );
  }
}








