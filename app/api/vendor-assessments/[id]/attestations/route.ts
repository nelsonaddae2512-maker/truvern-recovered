import { NextResponse } from "next/server";
import { governanceAuthErrorResponse } from "@/lib/auth/governance-auth-errors";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { requireVendorAssessmentAccess } from "@/lib/auth/truvern-governance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteContext = {
  params: Promise<{ id: string }>;
};

function parseId(value: unknown) {
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
    const attestationId = parseId(body.attestationId);

    if (!attestationId) {
      return NextResponse.json({ ok: false, error: "attestationId is required." }, { status: 400 });
    }

    const existing = await prisma.truvernAssessmentAttestation.findFirst({
      where: {
        id: attestationId,
        assessmentId,
      },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json({ ok: false, error: "Attestation request not found." }, { status: 404 });
    }

    const evidence =
      body.evidence === undefined
        ? Prisma.JsonNull
        : body.evidence === null
          ? Prisma.JsonNull
          : (body.evidence as Prisma.InputJsonValue);

    const attestation = await prisma.truvernAssessmentAttestation.update({
      where: { id: attestationId },
      data: {
        status: "SUBMITTED",
        submittedBy: typeof body.submittedBy === "string" ? body.submittedBy.trim() || null : null,
        submittedAt: new Date(),
        evidence,
        metadata: {
          source: "vendor-attestation-response",
          submittedAt: new Date().toISOString(),
        },
      },
    });

    await prisma.truvernFrameworkAssessment.update({
      where: { id: assessmentId },
      data: {
        status: "IN_REVIEW",
      },
    });

    return NextResponse.json({ ok: true, attestation });
  } catch (error) {
    const authError = governanceAuthErrorResponse(error);
    if (authError) return authError;

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to submit attestation.",
      },
      { status: 500 },
    );
  }
}



