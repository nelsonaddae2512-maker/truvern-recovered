import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import {
  reopenAssessmentRun,
} from "@/lib/services/review-reopen-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteContext = {
  params: Promise<{ id: string }>;
};

function safeInt(value: unknown) {
  const parsed = Number(String(value ?? "").trim());

  return Number.isFinite(parsed) && parsed > 0
    ? Math.floor(parsed)
    : null;
}

function safeStr(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function json(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, {
    status,
    headers: {
      "cache-control": "no-store",
    },
  });
}

export async function POST(_request: Request, context: RouteContext) {
  try {
    const { userId } = await auth();
    const params = await context.params;
    const assessmentRunId = safeInt(params?.id);

    if (!assessmentRunId) {
      return json(400, {
        ok: false,
        error: "Invalid assessment run id.",
      });
    }

    const result = await reopenAssessmentRun({
      assessmentRunId,
      actorUserId: userId,
    });

    return json(result.status, result.body);
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? safeStr(error.message)
        : "";

    return json(500, {
      ok: false,
      error: message || "Failed to reopen assessment run.",
    });
  }
}
