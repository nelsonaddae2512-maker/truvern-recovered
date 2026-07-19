import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { requireDbOrganization } from "@/lib/org-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function safeInt(value: unknown) {
  const n = Number(String(value ?? "").trim());
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

function json(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

export async function POST(req: Request) {
  const { userId } = await auth();

  if (!userId) {
    return json(401, { ok: false, error: "Unauthorized" });
  }

  const org = await requireDbOrganization().catch(() => null);
  const organizationId = org && "id" in org ? Number(org.id) : null;

  const body = await req.json().catch(() => ({}));
  const notificationId = safeInt(body?.notificationId);
  const markAll = body?.markAll === true;

  const scope = {
    OR: [
      { userId },
      ...(organizationId ? [{ organizationId, userId: null }] : []),
    ],
  };

  if (markAll) {
    const result = await prisma.notification.updateMany({
      where: {
        readAt: null,
        ...scope,
      },
      data: { readAt: new Date() },
    });

    return json(200, { ok: true, updated: result.count });
  }

  if (!notificationId) {
    return json(400, { ok: false, error: "notificationId is required." });
  }

  const result = await prisma.notification.updateMany({
    where: {
      id: notificationId,
      readAt: null,
      ...scope,
    },
    data: { readAt: new Date() },
  });

  return json(200, { ok: true, updated: result.count });
}


