import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { isTruvernOperator } from "@/lib/truvern-ops-access";
import { updateEvidenceRequestReviewStatus } from "@/lib/repositories/evidence-request-review-repository";
import { findEvidenceRequest } from "@/lib/repositories/evidence-request-repository";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function upper(value: unknown) {
  return String(value || "").trim().toUpperCase();
}

export async function POST(
  request: NextRequest,
  context: {
    params: Promise<{ id: string }>;
  },
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const canManageTruvernReview = await isTruvernOperator();

    if (!canManageTruvernReview) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Only authorized Truvern operators can review remediation evidence.",
        },
        { status: 403 },
      );
    }

    const params = await context.params;
    const id = Number(params.id);

    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "Invalid remediation request id.",
        },
        { status: 400 },
      );
    }

    const existing = await findEvidenceRequest({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json(
        {
          ok: false,
          error: "Remediation request not found.",
        },
        { status: 404 },
      );
    }

    const body = await request.json();

    const action = upper(body?.action);

    if (!["APPROVE", "REJECT", "REOPEN"].includes(action)) {
      return NextResponse.json(
        { ok: false, error: "Invalid action" },
        { status: 400 },
      );
    }

    let status = "REQUESTED";

    if (action === "APPROVE") {
      status = "APPROVED";
    }

    if (action === "REJECT") {
      status = "REJECTED";
    }

    if (action === "REOPEN") {
      status = "REQUESTED";
    }

    await updateEvidenceRequestReviewStatus({
      id,
      status,
    });

    return NextResponse.json({
      ok: true,
      status,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Failed to update remediation request",
      },
      { status: 500 },
    );
  }
}
