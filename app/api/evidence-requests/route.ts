import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function safeStr(v: unknown) {
  return typeof v === "string" ? v.trim() : "";
}

function json(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

function normalizeKind(v: unknown) {
  const s = safeStr(v).toUpperCase();

  if (s === "PENTEST" || s === "PEN_TEST" || s === "REPORT") return "OTHER";

  if (["SOC2", "ISO27001", "POLICY", "BCP_DRP", "OTHER"].includes(s)) {
    return s;
  }

  return "OTHER";
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return json(401, { ok: false, error: "Unauthorized" });
    }

    const body = await req.json().catch(() => ({}));

    const vendorId = Number(body?.vendorId);
    let organizationId = Number(body?.organizationId);
    const kind = normalizeKind(body?.kind);
    const title = safeStr(body?.label || body?.title) || "Evidence request";

    const dueAtRaw = safeStr(body?.dueAt);
    const dueAtDate = dueAtRaw ? new Date(dueAtRaw) : null;
    const dueAt =
      dueAtDate && !Number.isNaN(dueAtDate.getTime()) ? dueAtDate : null;

    if (!Number.isFinite(vendorId) || vendorId <= 0) {
      return json(400, { ok: false, error: "Vendor id required" });
    }

    if (!Number.isFinite(organizationId) || organizationId <= 0) {
      const vendor = await prisma.vendor.findUnique({
        where: { id: vendorId },
        select: { organizationId: true },
      });

      organizationId = Number(vendor?.organizationId);

      if (!Number.isFinite(organizationId) || organizationId <= 0) {
        return json(400, { ok: false, error: "Organization could not be resolved for this vendor." });
      }
    }

    const rows = await prisma.$queryRawUnsafe<Array<{ id: number }>>(
      `
      insert into "EvidenceRequest" (
        "vendorId",
        "organizationId",
        "requestedBy",
        kind,
        label,
        title,
        "dueAt",
        status,
        "createdAt",
        "updatedAt"
      )
      values (
        $1,
        $2,
        $3,
        $4::"EvidenceRequestKind",
        $5,
        $5,
        $6,
        'REQUESTED'::"EvidenceRequestStatus",
        now(),
        now()
      )
      returning id
      `,
      vendorId,
      organizationId,
      userId,
      kind,
      title,
      dueAt,
    );

    const id = rows?.[0]?.id ?? null;

    if (!id) {
      return json(500, { ok: false, error: "Evidence request was not created." });
    }

    return json(200, {
      ok: true,
      id,
      vendorId,
      organizationId,
      message: "Evidence request created.",
    });
  } catch (error: any) {
    console.error("Evidence request creation failed:", error);

    return json(500, {
      ok: false,
      error: safeStr(error?.message) || "Failed to create evidence request.",
    });
  }
}













