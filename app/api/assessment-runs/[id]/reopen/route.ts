import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import {
  getGovernanceActor,
  requireReviewerAccess,
} from "@/lib/auth/truvern-governance";
import {
  governanceAuthErrorResponse,
  governanceForbidden,
} from "@/lib/auth/governance-auth-errors";
import {
  findFirstAssessmentRun,
} from "@/lib/repositories/assessment-run-repository";
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

    await requireReviewerAccess();
    const actor = await getGovernanceActor();

    const assessmentRun = await findFirstAssessmentRun({
      where: {
        id: assessmentRunId,
      },
      select: {
        id: true,
        organizationId: true,
      },
    });

    if (!assessmentRun) {
      return json(404, {
        ok: false,
        error: "Assessment run not found.",
      });
    }

    if (
      actor.role !== "OPS" &&
      (
        actor.organizationId == null ||
        actor.organizationId !== assessmentRun.organizationId
      )
    ) {
      throw governanceForbidden(
        "You do not have access to this organization.",
      );
    }

    const result = await reopenAssessmentRun({
      assessmentRunId,
      actorUserId: userId,
    });

    return json(result.status, result.body);
  } catch (error: unknown) {
    const authResponse = governanceAuthErrorResponse(error);

    if (authResponse) {
      return authResponse;
    }
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
