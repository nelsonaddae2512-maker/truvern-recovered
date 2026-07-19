// app/vendor-portal/bootstrap/route.ts
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function json(data: any, status = 200) {
  return NextResponse.json(data, { status });
}

function isDevBypass(req: Request) {
  return req.headers.get("x-dev-bypass") === "1";
}

export async function GET(req: Request) {
  try {
    if (isDevBypass(req)) {
      const rawVendorId = req.headers.get("x-dev-vendor-id");
      const vendorId = rawVendorId ? Number(rawVendorId) : null;

      const link = await prisma.vendorPortalUser.findFirst({
        where: vendorId && Number.isFinite(vendorId) ? { vendorId } : {},
        orderBy: { id: "asc" },
        select: { id: true, vendorId: true },
      });

      if (!link?.vendorId) {
        return json({
          ok: true,
          linked: false,
          vendorId: null,
          mode: "dev-bypass",
        });
      }

      return json({
        ok: true,
        linked: true,
        vendorId: link.vendorId,
        mode: "dev-bypass",
      });
    }

    const a = await auth();

    if (!a?.userId) {
      return json(
        {
          ok: false,
          reason: "UNAUTHORIZED",
          redirect: `/sign-in?redirect_url=${encodeURIComponent("/vendor-portal")}`,
        },
        401,
      );
    }

    const link = await prisma.vendorPortalUser.findFirst({
      where: { clerkUserId: a.userId },
      select: { id: true, vendorId: true },
    });

    if (!link?.vendorId) {
      return json({ ok: true, linked: false, vendorId: null });
    }

    return json({ ok: true, linked: true, vendorId: link.vendorId });
  } catch (err: any) {
    return json(
      { ok: false, reason: "SERVER_ERROR", message: String(err?.message || err) },
      500,
    );
  }
}




