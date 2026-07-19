import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { isTruvernOperator } from "@/lib/truvern-ops-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function safeInt(value: unknown) {
  const n = Number(String(value ?? "").trim());
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

function safeStr(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function json(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

export async function POST(req: Request, ctx: RouteContext) {
  const { userId } = await auth();

  if (!userId) {
    return json(401, { ok: false, error: "Unauthorized." });
  }

  const canManageTruvernReview = await isTruvernOperator();

  if (!canManageTruvernReview) {
    return json(403, {
      ok: false,
      error: "Only authorized Truvern operators can unlock released reviews.",
    });
  }

  const body = await req.json().catch(() => ({}));
  const acceptedOverride = body?.acceptedOverride === true;
  const reason = safeStr(body?.reason);

  if (!acceptedOverride) {
    return json(400, {
      ok: false,
      error: "Operator override acknowledgement is required.",
    });
  }

  if (reason.length < 8) {
    return json(400, {
      ok: false,
      error: "Please provide an override reason.",
    });
  }

  const params = await ctx.params;
  const assignmentId = safeInt(params?.id);

  if (!assignmentId) {
    return json(400, { ok: false, error: "Invalid assignment id." });
  }

  const rows: any[] = await prisma.$queryRawUnsafe(
    `
    select *
    from "ReviewResponse"
    where "reviewAssignmentId" = $1
    order by "updatedAt" desc
    limit 1
    `,
    assignmentId,
  );

  const response = rows?.[0];

  if (!response) {
    return json(404, { ok: false, error: "Review response not found." });
  }

  const existing =
    response.responses && typeof response.responses === "object"
      ? response.responses
      : {};

  const previousReleaseState = safeStr(existing.releaseState) || "UNKNOWN";
  const nowIso = new Date().toISOString();

  const overrideEvent = {
    type: "TRUVERN_OPERATOR_EDIT_UNLOCK",
    accepted: true,
    acceptedAt: nowIso,
    acceptedByUserId: userId,
    reason,
    previousReleaseState,
    nextReleaseState: "DRAFT",
    statement:
      "Authorized Truvern operator acknowledged unlocking a previously released or confirmed governance outcome for controlled editing.",
  };

  const nextResponses = {
    ...existing,
    releaseState: "DRAFT",
    intent: "SAVE_DRAFT",
    unlockedAt: nowIso,
    unlockedByUserId: userId,
    operatorOverride: overrideEvent,
    operatorOverrideHistory: [
      ...(Array.isArray(existing.operatorOverrideHistory)
        ? existing.operatorOverrideHistory
        : []),
      overrideEvent,
    ],
  };

  await prisma.$executeRawUnsafe(
    `
    update "ReviewResponse"
    set
      responses = $1::jsonb,
      "updatedAt" = now()
    where id = $2
    `,
    JSON.stringify(nextResponses),
    response.id,
  );

  await prisma.$executeRawUnsafe(
    `
    update "ReviewAssignment"
    set
      status = 'IN_PROGRESS'::text,
      "updatedAt" = now()
    where id = $1
    `,
    assignmentId,
  );

  return json(200, {
    ok: true,
    assignmentId,
    responseId: response.id,
    previousReleaseState,
    releaseState: "DRAFT",
    overrideEvent,
  });
}

