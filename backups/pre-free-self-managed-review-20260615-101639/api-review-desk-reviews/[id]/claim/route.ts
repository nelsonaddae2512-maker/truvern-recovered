import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { isTruvernOperator } from "@/lib/truvern-ops-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteContext = {
  params: Promise<{ id: string }> | { id: string };
};

function parseId(v: unknown) {
  const m = String(v ?? "").match(/\d+/);
  if (!m) return null;

  const n = Number(m[0]);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

function safeStr(v: unknown) {
  return typeof v === "string" ? v.trim() : "";
}

function json(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, {
    status,
    headers: {
      "cache-control": "no-store, max-age=0",
    },
  });
}

function safeReturnTo(req: Request) {
  try {
    const url = new URL(req.url);
    const value = url.searchParams.get("returnTo");

    if (
      typeof value === "string" &&
      value.startsWith("/") &&
      !value.startsWith("//")
    ) {
      return value;
    }
  } catch {
    // noop
  }

  return null;
}

export async function POST(req: Request, context: RouteContext) {
  const returnTo = safeReturnTo(req);
  const { userId } = await auth();

  if (!userId) {
    return json(401, {
      ok: false,
      error: "Unauthorized",
    });
  }

  const params = await context.params;
  const assignmentId = parseId(params?.id);

  if (!assignmentId) {
    return json(400, {
      ok: false,
      error: "Invalid review assignment id",
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

  const existing = await prisma.$queryRaw<
    Array<{
      id: number;
      status: string | null;
      reviewerUserId: string | null;
      assignmentType: string | null;
      startedAt: Date | null;
    }>
  >`
    select
      id,
      status::text as status,
      "reviewerUserId",
      "assignmentType"::text as "assignmentType",
      "startedAt"
    from "ReviewAssignment"
    where id = ${assignmentId}
    limit 1
  `;

  const assignment = existing[0];

  if (!assignment) {
    return json(404, {
      ok: false,
      error: "Review assignment not found",
    });
  }

  const isTruvernAssignment =
    safeStr(assignment.assignmentType).toUpperCase() === "TRUVERN";

  if (isTruvernAssignment) {
    const canManageTruvernReview = await isTruvernOperator();

    if (!canManageTruvernReview) {
      return json(403, {
        ok: false,
        error: "Only authorized Truvern operators can claim Truvern reviews.",
      });
    }
  }
  const alreadyOwned = safeStr(assignment.reviewerUserId);

  if (alreadyOwned && assignment.reviewerUserId !== userId) {
    return json(409, {
      ok: false,
      error: "This review is already assigned",
      assignedReviewerName: "Assigned reviewer",
    });
  }

  await prisma.$executeRaw`
    update "ReviewAssignment"
    set
      "reviewerUserId" = ${userId},
      "assignedReviewerName" = ${displayName},
      "reviewerName" = ${displayName},
      "assignedTo" = ${displayName},
      "startedAt" = coalesce("startedAt", now()),
      "claimedAt" = coalesce("claimedAt", now()),
      "updatedAt" = now(),
      status = 'IN_PROGRESS'
    where id = ${assignmentId}
  `;

  if (returnTo) {
    const url = new URL(returnTo, req.url);
    url.searchParams.set("claimed", String(assignmentId));

    return NextResponse.redirect(url, {
      status: 303,
      headers: {
        "cache-control": "no-store, max-age=0",
      },
    });
  }

  return json(200, {
    ok: true,
    assignmentId,
    reviewerUserId: userId,
    assignedReviewerName: displayName,
    status: "IN_PROGRESS",
  });
}




