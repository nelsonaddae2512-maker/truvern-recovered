import { NextResponse } from "next/server";
import { governanceAuthErrorResponse } from "@/lib/auth/governance-auth-errors";
import { requireVendorAssessmentAccess } from "@/lib/auth/truvern-governance";
import { findFirstTruvernRemediationRequest, updateTruvernRemediationRequest } from "@/lib/repositories/truvern-remediation-request-repository";
import { updateTruvernFrameworkAssessment } from "@/lib/repositories/truvern-framework-assessment-repository";

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
    const remediationId = parseId(body.remediationId);
    const vendorResponse = typeof body.vendorResponse === "string" ? body.vendorResponse.trim() : "";

    if (!remediationId) {
      return NextResponse.json({ ok: false, error: "remediationId is required." }, { status: 400 });
    }

    if (!vendorResponse) {
      return NextResponse.json({ ok: false, error: "vendorResponse is required." }, { status: 400 });
    }

    const existing = await findFirstTruvernRemediationRequest({
      where: {
        id: remediationId,
        finding: {
          assessmentId,
        },
      },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json({ ok: false, error: "Remediation request not found." }, { status: 404 });
    }

    const remediation = await updateTruvernRemediationRequest({
      where: { id: remediationId },
      data: {
        status: "SUBMITTED",
        vendorResponse,
        submittedAt: new Date(),
        metadata: {
          source: "vendor-remediation-response",
          submittedAt: new Date().toISOString(),
        },
      },
    });

    await updateTruvernFrameworkAssessment({
      where: { id: assessmentId },
      data: {
        status: "IN_REVIEW",
      },
    });

    return NextResponse.json({ ok: true, remediation });
  } catch (error) {
    const authError = governanceAuthErrorResponse(error);
    if (authError) return authError;

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to submit remediation response.",
      },
      { status: 500 },
    );
  }
}



