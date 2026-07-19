import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

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

    const assessment = await prisma.assessment.findFirst({
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

    const rows: any[] = await prisma.$queryRawUnsafe(
      `
      select
        er.id,
        er."vendorId",
        er."organizationId",
        er.kind::text as kind,
        er.status::text as status,
        er.title,
        er.notes,
        er."reviewNote",
        er."dueAt",
        er."fulfilledEvidenceId",
        er."fulfilledAt",
        er."createdAt",
        er."updatedAt"
      from "EvidenceRequest" er
      where er."vendorId" = $1
        and er."organizationId" = $2
      order by
        case er.status::text
          when 'REQUESTED' then 1
          when 'FULFILLED' then 2
          when 'APPROVED' then 3
          when 'REJECTED' then 4
          else 5
        end,
        er."dueAt" asc nulls last,
        er.id desc
      `,
      assessment.vendorId,
      assessment.organizationId,
    );

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

