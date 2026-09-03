import { NextResponse } from "next/server";
import { findFirstAssessment } from "@/lib/repositories/assessment-repository";
import { readVendorAssessmentEvidenceRequests } from "@/lib/repositories/vendor-assessment-portal-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteContext = {
  params: Promise<{
    token?: string;
  }>;
};

function safeText(value: unknown) {
  return String(value ?? "").trim();
}

export async function GET(_req: Request, context: RouteContext) {
  try {
    const params = await context.params;
    const token = safeText(params?.token);

    if (!token) {
      return NextResponse.json(
        { ok: false, error: "Missing assessment token." },
        { status: 400 },
      );
    }

    const assessment = await findFirstAssessment({
      where: {
        token,
      },
      select: {
        id: true,
        vendorId: true,
        organizationId: true,
        vendorContactName: true,
        vendorEmail: true,
        title: true,
      },
    });

    if (!assessment) {
      return NextResponse.json(
        { ok: false, error: "Assessment not found." },
        { status: 404 },
      );
    }

    const rows = await readVendorAssessmentEvidenceRequests({
      assessmentId: assessment.id,
      vendorId: assessment.vendorId,
      organizationId: assessment.organizationId,
    });

    return NextResponse.json({
      ok: true,
      assessment,
      evidenceRequests: rows,
      count: rows.length,
    });
  } catch (error: any) {
    console.error("Vendor evidence request lookup failed:", error);

    return NextResponse.json(
      {
        ok: false,
        error: safeText(error?.message) || "Failed to load evidence requests.",
      },
      { status: 500 },
    );
  }
}

