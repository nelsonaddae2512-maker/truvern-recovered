import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import {
  getGovernanceActor,
  requireGovernanceCapability,
} from "@/lib/auth/truvern-governance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function json(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, {
    status,
    headers: { "cache-control": "no-store, max-age=0" },
  });
}

function safeStr(v: unknown) {
  return typeof v === "string" ? v.trim() : "";
}

function parseIds(v: unknown) {
  if (!Array.isArray(v)) return [];

  return Array.from(
    new Set(
      v
        .map((item) => Number(item))
        .filter((n) => Number.isFinite(n) && n > 0)
        .map((n) => Math.floor(n)),
    ),
  ).slice(0, 100);
}

export async function POST(req: Request) {
  const { userId } = await auth();

  if (!userId) {
    return json(401, { ok: false, error: "Unauthorized" });
  }

  const governanceActor =
    await getGovernanceActor();

  requireGovernanceCapability(
    governanceActor,
    "assessment.review",
  );

  const body = await req.json().catch(() => null);
  const assignmentIds = parseIds(body?.assignmentIds);

  if (!assignmentIds.length) {
    return json(400, {
      ok: false,
      error: "No valid assignment ids provided",
    });
  }

  const user = await currentUser();

  const displayName =
    safeStr(user?.fullName) ||
    [safeStr(user?.firstName), safeStr(user?.lastName)]
      .filter(Boolean)
      .join(" ") ||
    safeStr(user?.primaryEmailAddress?.emailAddress) ||
    "Internal reviewer";

  const rows = await prisma.$queryRaw<
    Array<{
      id: number;
      organizationId: number;
      assignmentType: string;
      reviewerUserId: string | null;
    }>
  >`
    select
      id,
      "reviewerUserId",
      "organizationId",
      "assignmentType"
    from "ReviewAssignment"
    where id = any(${assignmentIds}::int[])
  `;


  const authorizedRows = rows.filter((row) => {
    if (governanceActor.role === "OPS") {
      return true;
    }

    if (governanceActor.role === "TRUVERN_REVIEWER") {
      return safeStr(row.assignmentType).toUpperCase() === "TRUVERN";
    }

    return (
      governanceActor.organizationId != null &&
      governanceActor.organizationId === row.organizationId
    );
  });

  const existingIds = new Set(authorizedRows.map((row) => Number(row.id)));

  const unassignedIds = authorizedRows
    .filter((row: any) => !safeStr(row.reviewerUserId))
    .map((row: any) => Number(row.id));

  if (unassignedIds.length) {
    await prisma.$executeRaw`
      update "ReviewAssignment"
      set
        "reviewerUserId" = ${userId},
        "startedAt" = coalesce("startedAt", now()),
        "updatedAt" = now(),
        status = 'IN_PROGRESS'::text
      where id = any(${unassignedIds}::int[])
    `;
  }

  const missingIds = assignmentIds.filter((id) => !existingIds.has(id));
  const alreadyAssignedCount = rows.length - unassignedIds.length;

  return json(200, {
    ok: true,
    requested: assignmentIds.length,
    updated: unassignedIds.length,
    skippedAlreadyAssigned: alreadyAssignedCount,
    skippedMissing: missingIds.length,
    updatedIds: unassignedIds,
    missingIds,
    assignedReviewerName: displayName,
  });
}






