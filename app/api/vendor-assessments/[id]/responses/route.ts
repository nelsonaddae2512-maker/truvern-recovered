import { NextResponse } from "next/server";
import { governanceAuthErrorResponse } from "@/lib/auth/governance-auth-errors";
import prisma from "@/lib/prisma";
import { requireVendorAssessmentAccess } from "@/lib/auth/truvern-governance";
import { Prisma } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteContext = {
  params: Promise<{ id: string }>;
};

function parseId(value: string) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id: rawId } = await context.params;
    const assessmentId = parseId(rawId);

    if (!assessmentId) {
      return NextResponse.json({ ok: false, error: "Invalid assessment id." }, { status: 400 });
    }

    await requireVendorAssessmentAccess(assessmentId);

    const body = await request.json().catch(() => ({}));
    const responseId = parseId(String(body.responseId ?? ""));

    if (!responseId) {
      return NextResponse.json({ ok: false, error: "responseId is required." }, { status: 400 });
    }

    const response = await prisma.truvernAssessmentResponse.update({
      where: {
        id: responseId,
        assessmentId,
      },
      data: {
        answer: body.answer === undefined ? undefined : body.answer,
        vendorNotes: typeof body.vendorNotes === "string" ? body.vendorNotes : undefined,
        evidence:
          body.evidence === undefined
            ? undefined
            : body.evidence === null
              ? Prisma.JsonNull
              : (body.evidence as Prisma.InputJsonValue),
      },
    });

    await prisma.truvernFrameworkAssessment.update({
      where: { id: assessmentId },
      data: {
        status: "VENDOR_IN_PROGRESS",
      },
    });

    return NextResponse.json({ ok: true, response });
  } catch (error) {
    const authError = governanceAuthErrorResponse(error);
    if (authError) return authError;

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to save vendor response.",
      },
      { status: 500 },
    );
  }
}





