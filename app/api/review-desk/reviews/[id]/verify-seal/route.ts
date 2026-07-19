import { createHash } from "node:crypto";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentPlanEntitlements } from "@/lib/billing/plan-entitlements";
import { requireDbOrganization } from "@/lib/org-db";
import { createGovernanceChecksum } from "@/lib/governance-checksum";

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

function safeInt(v: unknown) {
  const n = Number(String(v ?? "").trim());
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

function upper(v: unknown) {
  return safeStr(v).toUpperCase();
}

function section(text: string, heading: string, stops: string[]) {
  const source = text || "";
  const start = source.toUpperCase().indexOf(heading.toUpperCase());

  if (start < 0) return "";

  const after = source.slice(start + heading.length).trim();

  let end = after.length;

  for (const stop of stops) {
    const idx = after.toUpperCase().indexOf(stop.toUpperCase());

    if (idx >= 0 && idx < end) {
      end = idx;
    }
  }

  return after.slice(0, end).trim();
}

export async function GET(_req: Request, ctx: RouteContext) {
  try {
    const gate = await requireApiAuth();

    if (!gate.ok) {
      return gate.response;
    }
const params = await ctx.params;
    const assignmentId = safeInt(params?.id);

    if (!assignmentId) {
      return NextResponse.json(
        { ok: false, error: "Invalid assignment id." },
        { status: 400 },
      );
    }

    const entitlements = await getCurrentPlanEntitlements();

    if (!entitlements.canUseGovernanceExports) {
      return NextResponse.json(
        {
          ok: false,
          error: "Upgrade to Pro to verify immutable governance seals.",
        },
        {
          status: 402,
        },
      );
    }

    const rows: any[] = await prisma.$queryRawUnsafe(
      `
      select
        ra.id as "assignmentId",
        ra.status as "assignmentStatus",
        rr.id as "responseId",
        rr.responses,
        rr."updatedAt" as "outcomeUpdatedAt",
        v.id as "vendorId",
        v.name as "vendorName"
      from "ReviewAssignment" ra
      left join "ReviewResponse" rr on rr."reviewAssignmentId" = ra.id
      left join "ReviewRequest" req on req.id = ra."reviewRequestId"
      left join "Vendor" v on v.id = req."vendorId"
      where ra.id = $1
      order by rr."updatedAt" desc nulls last
      limit 1
      `,
      assignmentId,
    );

    const row = rows?.[0];

    if (!row) {
      return NextResponse.json(
        { ok: false, error: "Review assignment not found." },
        { status: 404 },
      );
    }

    const responses =
      row.responses && typeof row.responses === "object"
        ? row.responses
        : {};

    const snapshot =
      responses?.governanceReleaseSnapshot &&
      typeof responses.governanceReleaseSnapshot === "object"
        ? responses.governanceReleaseSnapshot
        : null;

    const snapshotAssessment =
      snapshot?.normalizedAssessment &&
      typeof snapshot.normalizedAssessment === "object"
        ? snapshot.normalizedAssessment
        : null;

    const structured =
      snapshot?.structuredAssessment &&
      typeof snapshot.structuredAssessment === "object"
        ? snapshot.structuredAssessment
        : responses.structuredAssessment &&
            typeof responses.structuredAssessment === "object"
          ? responses.structuredAssessment
          : {};

    const findings = safeStr(snapshot?.findings) || safeStr(responses.findings);

    const executiveSummary =
      safeStr((snapshotAssessment as any)?.executiveSummary) ||
      safeStr((structured as any).executiveSummary) ||
      section(findings, "EXECUTIVE SUMMARY", [
        "GOVERNANCE DECISION",
        "TRUVERN GOVERNANCE REVIEW",
        "CONDITIONS & FOLLOW-UPS",
      ]);

    const finalAssessment =
      safeStr((snapshotAssessment as any)?.finalAssessment) ||
      safeStr((structured as any).finalAssessment) ||
      section(findings, "TRUVERN GOVERNANCE REVIEW", [
        "CONDITIONS & FOLLOW-UPS",
      ]);

    const conditions = Array.isArray((snapshotAssessment as any)?.conditions)
      ? (snapshotAssessment as any).conditions.map(String).filter(Boolean)
      : Array.isArray((structured as any).conditionsAndFollowUps)
        ? (structured as any).conditionsAndFollowUps
            .map(String)
            .filter(Boolean)
        : section(findings, "CONDITIONS & FOLLOW-UPS", [])
            .split("\n")
            .map((v) => v.trim())
            .filter(Boolean);

    const renderedChecksum = createGovernanceChecksum({
      assignmentId,
      vendorName: row.vendorName,
      decision: safeStr(snapshot?.decision) || safeStr(responses.decision),
      riskLevel: safeStr(snapshot?.riskLevel) || safeStr(responses.riskLevel),
      releaseState: upper(snapshot?.releaseState) || upper(responses.releaseState),
      executiveSummary,
      finalAssessment,
      conditions,
      finalizedAt:
        snapshot?.governanceSeal?.sealedAt ||
        snapshot?.releasedAt ||
        responses?.governanceSeal?.sealedAt ||
        responses.confirmedAt ||
        row.outcomeUpdatedAt,
    });

    const persistedChecksum = safeStr(
      responses?.governanceSeal?.checksum,
    );

    const verified =
      !!persistedChecksum &&
      persistedChecksum === renderedChecksum;

    return NextResponse.json(
      {
        ok: true,
        assignmentId,
        responseId: row.responseId,
        verified,
        persistedChecksum: persistedChecksum || null,
        renderedChecksum,
        releaseState: safeStr(responses.releaseState),
        sealVersion:
          safeStr(responses?.governanceSeal?.version) || null,
        sealedAt:
          responses?.governanceSeal?.sealedAt || null,
      },
      {
        headers: {
          "cache-control": "no-store",
        },
      },
    );
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error:
          safeStr(error?.message) ||
          "Failed to verify governance seal.",
      },
      {
        status: 500,
      },
    );
  }
}







