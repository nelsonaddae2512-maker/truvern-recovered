import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { logActivityEvent } from "@/lib/activity-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type LatestOutcomeRow = {
  assignmentId: number;
  assignmentStatus: string | null;
  organizationId: number | null;
  vendorId: number | null;
  vendorName: string | null;
  responseId: number | null;
  responses: unknown;
};

function safeIds(value: unknown) {
  if (!Array.isArray(value)) return [];

  return Array.from(
    new Set(
      value
        .map((item) => Number(item))
        .filter((item) => Number.isFinite(item) && item > 0)
        .map((item) => Math.floor(item)),
    ),
  ).slice(0, 100);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function upper(value: unknown) {
  return typeof value === "string" ? value.trim().toUpperCase() : "";
}

export async function POST(req: Request) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  const body = await req.json().catch(() => null);
  const assignmentIds = safeIds(body?.assignmentIds);

  if (!assignmentIds.length) {
    return NextResponse.json(
      { ok: false, error: "No review assignments selected." },
      { status: 400 },
    );
  }

  const latestRows = await prisma.$queryRaw<LatestOutcomeRow[]>`
    select
      ra.id::int as "assignmentId",
      ra.status::text as "assignmentStatus",
      ra."organizationId"::int as "organizationId",
      rr."vendorId"::int as "vendorId",
      v.name::text as "vendorName",
      latest.id::int as "responseId",
      latest.responses as "responses"
    from "ReviewAssignment" ra
    left join "ReviewRequest" rr on rr.id = ra."reviewRequestId"
    left join "Vendor" v on v.id = rr."vendorId"
    left join lateral (
      select resp.id, resp.responses
      from "ReviewResponse" resp
      where resp."reviewAssignmentId" = ra.id
      order by resp."updatedAt" desc, resp.id desc
      limit 1
    ) latest on true
    where ra.id = any(${assignmentIds}::int[])
  `;

  const nowIso = new Date().toISOString();

  let released = 0;
  let skippedAlreadyReleased = 0;
  let skippedNotCompleted = 0;
  let skippedNoOutcome = 0;

  for (const row of latestRows) {
    if (!row.responseId) {
      skippedNoOutcome += 1;
      continue;
    }

    const responses = asRecord(row.responses);
    const intent = upper(responses.intent);
    const releaseState = upper(responses.releaseState);
    const assignmentStatus = upper(row.assignmentStatus);

    if (releaseState === "RELEASED" || intent === "RELEASE") {
      skippedAlreadyReleased += 1;
      continue;
    }

    const isReleaseReady =
      intent === "COMPLETE" ||
      releaseState === "COMPLETED" ||
      assignmentStatus === "SUBMITTED";

    if (!isReleaseReady) {
      skippedNotCompleted += 1;
      continue;
    }

    const nextResponses = {
      ...responses,
      intent: "RELEASE",
      releaseState: "RELEASED",
      releasedAt:
        typeof responses.releasedAt === "string" && responses.releasedAt
          ? responses.releasedAt
          : nowIso,
      bulkReleasedAt: nowIso,
      bulkReleasedBy: userId,
    };

    await prisma.$executeRaw`
      update "ReviewResponse"
      set
        responses = cast(${JSON.stringify(nextResponses)} as jsonb),
        "submittedAt" = coalesce("submittedAt", now()),
        "updatedAt" = now()
      where id = ${row.responseId}
    `;

    await prisma.$executeRaw`
      update "ReviewAssignment"
      set "updatedAt" = now()
      where id = ${row.assignmentId}
    `;

    if (row.organizationId) {
      await logActivityEvent({
        organizationId: row.organizationId,
        vendorId: row.vendorId,
        type: "REVIEW_BULK_RELEASED",
        title: `Review released · ${row.vendorName || `Assignment #${row.assignmentId}`}`,
        description:
          "A completed review was released through the Governance Ops bulk release workflow.",
        metadata: {
          assignmentId: row.assignmentId,
          responseId: row.responseId,
          releaseState: "RELEASED",
          releasedAt: nowIso,
          bulkReleased: true,
          actorUserId: userId,
        },
        actor: {
          userId: null,
          name: "Governance Ops",
          email: null,
        },
      });
    }

    released += 1;
  }

  const missing = assignmentIds.length - latestRows.length;

  return NextResponse.json({
    ok: true,
    released,
    skippedAlreadyReleased,
    skippedNotCompleted,
    skippedNoOutcome: skippedNoOutcome + Math.max(0, missing),
  });
}





