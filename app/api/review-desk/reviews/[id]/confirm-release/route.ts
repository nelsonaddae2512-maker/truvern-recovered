import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { requireDbOrganization } from "@/lib/org-db";
import {
  confirmReviewRelease,
} from "@/lib/services/review-release-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteContext = {
  params: Promise<{ id: string }>;
};

function safeInt(
  value: unknown,
): number | null {
  const parsed =
    Number(String(value ?? "").trim());

  return (
    Number.isFinite(parsed) &&
    parsed > 0
  )
    ? Math.floor(parsed)
    : null;
}

function safeString(
  value: unknown,
): string {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function json(
  status: number,
  body: Record<string, unknown>,
) {
  return NextResponse.json(body, {
    status,
    headers: {
      "cache-control": "no-store",
    },
  });
}

export async function POST(
  req: Request,
  context: RouteContext,
) {
  const { userId } = await auth();

  if (!userId) {
    return json(401, {
      ok: false,
      error: "Unauthorized",
    });
  }

  try {
    await requireDbOrganization();
  } catch {
    return json(403, {
      ok: false,
      error: "Organization required",
    });
  }

  const params = await context.params;

  const assignmentId =
    safeInt(params?.id);

  if (!assignmentId) {
    return json(400, {
      ok: false,
      error: "Invalid assignment id.",
    });
  }

  const body =
    await req
      .json()
      .catch(() => ({}));

  const result =
    await confirmReviewRelease({
      assignmentId,
      actorUserId: userId,
      acceptedAcknowledgement:
        body?.acceptedAcknowledgement === true,
      acknowledgementType:
        safeString(
          body?.acknowledgementType,
        ) || null,
    });

  return json(
    result.status,
    result.body,
  );
}