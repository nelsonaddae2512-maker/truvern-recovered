// app/vendor-portal/summary/route.ts
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function json(data: Record<string, unknown>, status = 200) {
  return NextResponse.json(data, { status });
}

export async function GET() {
  try {
    const a = await auth();

    if (!a?.userId) {
      return json({ ok: false, reason: "UNAUTHORIZED" }, 401);
    }

    const link = await prisma.vendorPortalUser.findFirst({
      where: { clerkUserId: a.userId },
      select: {
        vendorId: true,
      },
    });

    if (!link?.vendorId) {
      return json({ ok: true, linked: false, vendorId: null });
    }

    return json({
      ok: true,
      linked: true,
      vendorId: link.vendorId,
    });
  } catch (err: any) {
    return json(
      { ok: false, reason: "SERVER_ERROR", message: String(err?.message || err) },
      500,
    );
  }
}




