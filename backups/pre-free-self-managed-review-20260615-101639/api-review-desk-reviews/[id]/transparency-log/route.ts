import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireDbOrganization } from "@/lib/org-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
async function requireApiAuth() {
  const { userId } = await auth();

  if (!userId) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401, headers: { "cache-control": "no-store" } },
      ),
    };
  }

  try {
    const org = await requireDbOrganization();

    return {
      ok: true as const,
      userId,
      org,
    };
  } catch {
    return {
      ok: false as const,
      response: NextResponse.json(
        { ok: false, error: "Organization required" },
        { status: 403, headers: { "cache-control": "no-store" } },
      ),
    };
  }
}

type RouteContext = {
  params: Promise<{ id: string }>;
};

function safeInt(v: unknown) {
  const n = Number(String(v ?? "").trim());
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

export async function GET(_req: Request, ctx: RouteContext) {
  try {
    const gate = await requireApiAuth();

    if (!gate.ok) {
      return gate.response;
    }
const params = await ctx.params;
    const assignmentId = safeInt(params?.id);

    if (!assignmentId) {
      return NextResponse.json(
        { ok: false, error: "Invalid assignment id." },
        { status: 400 },
      );
    }

    const rows: any[] = await prisma.$queryRawUnsafe(
      `
      select
        id,
        "entryId",
        "assignmentId",
        "responseId",
        checksum,
        "ledgerHash",
        "receiptId",
        timestamp,
        "previousEntryHash",
        "entryHash",
        "createdAt"
      from "GovernanceTransparencyLog"
      where "assignmentId" = $1
      order by timestamp desc, id desc
      `,
      assignmentId,
    );

    return NextResponse.json(
      {
        ok: true,
        assignmentId,
        entryCount: rows.length,
        entries: rows,
      },
      {
        headers: {
          "cache-control": "no-store",
        },
      },
    );
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error:
          typeof error?.message === "string"
            ? error.message
            : "Failed to read transparency log.",
      },
      { status: 500 },
    );
  }
}


