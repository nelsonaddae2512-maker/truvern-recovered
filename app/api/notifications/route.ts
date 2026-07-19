import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { requireDbOrganization } from "@/lib/org-db";
import { requireTruvernOperator } from "@/lib/truvern-ops-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function json(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

export async function GET() {
  const { userId } = await auth();

  if (!userId) {
    return json(401, { ok: false, notifications: [] });
  }

  const org = await requireDbOrganization().catch(() => null);
  const organizationId = org && "id" in org ? Number(org.id) : null;
  const isTruvernOperator = await requireTruvernOperator()
    .then(() => true)
    .catch(() => false);

  const notifications = await prisma.notification.findMany({
    where: {
      OR: [
        { userId },
        ...(organizationId ? [{ organizationId, userId: null }] : []),
        ...(isTruvernOperator
          ? [{ type: "ASSESSMENT_ASSIGNED_TRUVERN" as const }]
          : []),
      ],
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 40,
  });

  return json(200, { ok: true, notifications });
}
