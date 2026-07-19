import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";

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

    const params = await context.params;
    const id = Number(params.id);

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

    await prisma.$executeRawUnsafe(`
      UPDATE "EvidenceRequest"
      SET
        status = '${status}'::"EvidenceRequestStatus",
        "updatedAt" = NOW()
      WHERE id = ${id}
    `);

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



