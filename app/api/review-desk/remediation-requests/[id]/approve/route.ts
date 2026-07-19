import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { isTruvernOperator } from "@/lib/truvern-ops-access";

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

    const rows: Array<{ id: number }> = await prisma.$queryRawUnsafe(
      `
      update "EvidenceRequest"
      set
        status = 'APPROVED',
        "updatedAt" = now()
      where id = $1
      returning id
      `,
      id,
    );

    if (!rows[0]?.id) {
      return json(404, {
        ok: false,
        error: "Remediation request not found.",
      });
    }

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

