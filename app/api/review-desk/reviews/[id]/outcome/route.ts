import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireDbOrganization } from "@/lib/org-db";
import { isTruvernOperator } from "@/lib/truvern-ops-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
async function requireApiAuth() {
  const { userId } = await auth();

  if (!userId) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401, headers: { "cache-control": "no-store" } },
      ),
    };
  }

  try {
    const org = await requireDbOrganization();

    return {
      ok: true as const,
      userId,
      org,
    };
  } catch {
    return {
      ok: false as const,
      response: NextResponse.json(
        { ok: false, error: "Organization required" },
        { status: 403, headers: { "cache-control": "no-store" } },
      ),
    };
  }
}

type RouteContext = {
  params: Promise<{ id: string }>;
};

function safeStr(v: unknown) {
  return typeof v === "string" ? v.trim() : "";
}

function upper(v: unknown) {
  return safeStr(v).toUpperCase();
}

function safeInt(v: unknown) {
  const n = Number(String(v ?? "").trim());
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

function normalizeIntent(v: unknown) {
  const s = upper(v);
  if (["SAVE_DRAFT", "COMPLETE", "RELEASE"].includes(s)) return s;
  return "SAVE_DRAFT";
}

function normalizeDecision(v: unknown) {
  const s = upper(v);
  if (
    ["PENDING", "APPROVE", "APPROVE_WITH_CONDITIONS", "REJECT", "ESCALATE"].includes(s)
  ) {
    return s;
  }
  return "PENDING";
}

function normalizeRisk(v: unknown) {
  const s = upper(v);
  if (["LOW", "MEDIUM", "HIGH", "CRITICAL"].includes(s)) return s;
  return "MEDIUM";
}

function json(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

export async function POST(req: Request, ctx: RouteContext) {
  const gate = await requireApiAuth();

  if (!gate.ok) {
    return gate.response;
  }

try {
    const params = await ctx.params;
    const assignmentId = safeInt(params?.id);

    if (!assignmentId) {
      return json(400, { ok: false, error: "Invalid assignment id." });
    }

    const body = await req.json().catch(() => ({}));

    const intent = normalizeIntent(body?.intent);
    const findings = safeStr(body?.findings);
    const decision = normalizeDecision(body?.decision);
    const riskLevel = normalizeRisk(body?.riskLevel);
    const assignmentType =
      upper(body?.assignmentType) === "TRUVERN" ? "TRUVERN" : "INTERNAL";

    const assignmentRows: any[] = await prisma.$queryRawUnsafe(
      `select * from "ReviewAssignment" where id = $1 limit 1`,
      assignmentId,
    );

    const assignment = assignmentRows?.[0];

    if (!assignment) {
      return json(404, { ok: false, error: "Assignment not found." });
    }

    const requestId = assignment.reviewRequestId ?? assignment.requestId;

    const requestRows: any[] = await prisma.$queryRawUnsafe(
      `select * from "ReviewRequest" where id = $1 limit 1`,
      requestId,
    );

    const reviewRequest = requestRows?.[0];

    if (!reviewRequest) {
      return json(404, { ok: false, error: "Review request not found." });
    }

    const releaseState =
  intent === "RELEASE"
    ? "RELEASED"
    : intent === "COMPLETE"
      ? "COMPLETED"
      : "DRAFT";

    const assignmentStatus =
      intent === "SAVE_DRAFT" ? "IN_PROGRESS" : "SUBMITTED";

    const nowIso = new Date().toISOString();


    const existingRows: any[] = await prisma.$queryRawUnsafe(
      `
      select *
      from "ReviewResponse"
      where "reviewAssignmentId" = $1
      order by "updatedAt" desc
      limit 1
      `,
      assignmentId,
    );

    const existing = existingRows?.[0];
    const existingResponses =
  existing?.responses &&
  typeof existing.responses === "object"
    ? existing.responses
    : {};

    const incomingStructuredAssessment =
      body?.structuredAssessment &&
      typeof body.structuredAssessment === "object"
        ? body.structuredAssessment
        : {};

    const existingStructuredAssessment =
      existingResponses?.structuredAssessment &&
      typeof existingResponses.structuredAssessment === "object"
        ? existingResponses.structuredAssessment
        : {};

    const mergedStructuredAssessment = {
      ...existingStructuredAssessment,
      ...incomingStructuredAssessment,
    };

    const resolvedExecutiveSummary =
      safeStr(body?.executiveSummary) ||
      safeStr(mergedStructuredAssessment?.executiveSummary) ||
      safeStr(existingResponses?.executiveSummary) ||
      safeStr(existingResponses?.truvernReviewerIntelligence?.executiveSummary) ||
      "";

    const resolvedFinalAssessment =
      safeStr(body?.finalAssessment) ||
      safeStr(body?.finalRecommendation) ||
      safeStr(mergedStructuredAssessment?.finalAssessment) ||
      safeStr(mergedStructuredAssessment?.finalRecommendation) ||
      safeStr(existingResponses?.finalAssessment) ||
      safeStr(existingResponses?.finalRecommendation) ||
      safeStr(existingResponses?.truvernReviewerIntelligence?.finalAssessment) ||
      safeStr(existingResponses?.truvernReviewerIntelligence?.finalRecommendation) ||
      "";

    const resolvedConditionsAndFollowUps = Array.isArray(body?.conditionsAndFollowUps)
      ? body.conditionsAndFollowUps
      : Array.isArray(mergedStructuredAssessment?.conditionsAndFollowUps)
        ? mergedStructuredAssessment.conditionsAndFollowUps
        : Array.isArray(existingResponses?.conditionsAndFollowUps)
          ? existingResponses.conditionsAndFollowUps
          : Array.isArray(existingResponses?.truvernReviewerIntelligence?.followUps)
            ? existingResponses.truvernReviewerIntelligence.followUps
            : [];

    const responses = {
      ...existingResponses,
      schema: "truvern.vendor_review_response.v1",
      intent,
      assignmentType,
      decision,
      riskLevel,
      releaseState,
      findings,
      structuredAssessment: {
        ...mergedStructuredAssessment,
        executiveSummary: resolvedExecutiveSummary,
        finalAssessment: resolvedFinalAssessment,
        finalRecommendation: resolvedFinalAssessment,
        conditionsAndFollowUps: resolvedConditionsAndFollowUps,
      },
      savedAt: nowIso,
      completedAt: intent === "COMPLETE" ? nowIso : existingResponses?.completedAt ?? null,
      releasedAt: intent === "RELEASE" ? nowIso : existingResponses?.releasedAt ?? null,
    };

const existingReleaseState = upper(
  existingResponses?.releaseState,
);

const existingAssignmentType = upper(
  existingResponses?.assignmentType ||
    assignment.assignmentType,
);

const releasedOrConfirmed =
  existingReleaseState === "RELEASED" ||
  existingReleaseState === "CONFIRMED";

if (
  existingAssignmentType === "TRUVERN" &&
  releasedOrConfirmed
) {
  return json(409, {
    ok: false,
    error:
      existingReleaseState === "CONFIRMED"
        ? "Confirmed Truvern outcomes are locked."
        : "Released Truvern outcomes are awaiting customer confirmation and cannot be edited.",
  });
}
    let responseId: number | null = null;

    if (existing?.id) {
      const updatedRows: any[] = await prisma.$queryRawUnsafe(
        `
        update "ReviewResponse"
        set
          responses = $1::jsonb,
          "draftSavedAt" = case
            when $2 = 'SAVE_DRAFT' then now()
            else "draftSavedAt"
          end,
          "submittedAt" = case
            when $2 in ('COMPLETE', 'RELEASE') then now()
            else "submittedAt"
          end,
          "updatedAt" = now()
        where id = $3
        returning id
        `,
        JSON.stringify(responses),
        intent,
        existing.id,
      );

      responseId = updatedRows?.[0]?.id ?? existing.id;
    } else {
      const insertedRows: any[] = await prisma.$queryRawUnsafe(
        `
        insert into "ReviewResponse" (
          "organizationId",
          "reviewRequestId",
          "reviewAssignmentId",
          responses,
          "draftSavedAt",
          "submittedAt",
          "createdAt",
          "updatedAt"
        )
        values (
          $1,
          $2,
          $3,
          $4::jsonb,
          case when $5 = 'SAVE_DRAFT' then now() else null end,
          case when $5 in ('COMPLETE', 'RELEASE') then now() else null end,
          now(),
          now()
        )
        returning id
        `,
        reviewRequest.organizationId,
        reviewRequest.id,
        assignmentId,
        JSON.stringify(responses),
        intent,
      );

      responseId = insertedRows?.[0]?.id ?? null;
    }

    await prisma.$executeRawUnsafe(
      `
      update "ReviewAssignment"
      set
        status = $2::text,
        "startedAt" = coalesce("startedAt", now()),
        "submittedAt" = case
          when $2 = 'SUBMITTED' then now()
          else "submittedAt"
        end,
        "updatedAt" = now()
      where id = $1
      `,
      assignmentId,
      assignmentStatus,
    );

    return json(200, {
      ok: true,
      responseId,
      intent,
      assignmentStatus,
      displayStatus:
        intent === "RELEASE"
          ? "RELEASED"
          : intent === "COMPLETE"
            ? "COMPLETED"
            : "IN_PROGRESS",
      releaseState,
      decision,
      riskLevel,
    });
  } catch (error: any) {
    return json(500, {
      ok: false,
      error: safeStr(error?.message) || "Failed to save review response.",
    });
  }
}









