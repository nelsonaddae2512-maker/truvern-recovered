import { NextResponse } from "next/server";
import { requireReviewerAccess } from "@/lib/auth/truvern-governance";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteContext = {
  params: Promise<{
    vendorId?: string;
  }>;
};

function safeInt(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export async function GET(_req: Request, context: RouteContext) {
  try {
    await requireReviewerAccess();
    const params = await context.params;
    const vendorId = safeInt(params?.vendorId);

    if (!vendorId) {
      return NextResponse.json(
        { ok: false, error: "Invalid vendor id." },
        { status: 400 },
      );
    }

    const rows: any[] = await prisma.$queryRawUnsafe(
      `
      select
        er.id as "requestId",
        er.title as "requestTitle",
        er.status::text as "requestStatus",
        er."fulfilledEvidenceId",
        er."fulfilledAt",
        er."reviewNote",
        e.id as "evidenceId",
        e.title as "evidenceTitle",
        e.notes as "evidenceNotes",
        e.url as "evidenceUrl",
        e."createdAt" as "evidenceUploadedAt"
      from "EvidenceRequest" er
      left join "Evidence" e
        on e.id = er."fulfilledEvidenceId"
      where er."vendorId" = $1
      order by er."updatedAt" desc, er.id desc
      `,
      vendorId,
    );

    return NextResponse.json({
      ok: true,
      vendorId,
      submissions: rows,
    });
  } catch (error: any) {
    console.error("Review desk evidence submissions lookup failed:", error);

    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to load evidence submissions." },
      { status: 500 },
    );
  }
}


