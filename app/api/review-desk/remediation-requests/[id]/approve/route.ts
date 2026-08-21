import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { isTruvernOperator } from "@/lib/truvern-ops-access";
import { findEvidenceRequest, updateEvidenceRequest } from "@/lib/repositories/evidence-request-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

export async function POST(
  _req: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return json(401, { ok: false, error: "Unauthorized." });
    }

    const canManageTruvernReview = await isTruvernOperator();

    if (!canManageTruvernReview) {
      return json(403, {
        ok: false,
        error:
          "Only authorized Truvern operators can approve remediation evidence.",
      });
    }

    const params = await context.params;
    const id = Number(params.id);

    if (!Number.isFinite(id) || id <= 0) {
      return json(400, {
        ok: false,
        error: "Invalid remediation request id.",
      });
    }

    const existing = await findEvidenceRequest({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      return json(404, {
        ok: false,
        error: "Remediation request not found.",
      });
    }

    await updateEvidenceRequest({
      where: { id },
      data: {
        status: "APPROVED",
      },
    });


    return json(200, {
      ok: true,
      status: "APPROVED",
    });
  } catch (error: any) {
    return json(500, {
      ok: false,
      error: error?.message || "Failed to approve remediation.",
    });
  }
}

