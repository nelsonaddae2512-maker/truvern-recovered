// app/api/review-desk/reviews/route.ts

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { requireDbOrganization } from "@/lib/org-db";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type OrgJsonRow = {
  orgJson: Record<string, unknown> | null;
};

function json(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

async function requireApiAuth() {
  const { userId } = await auth();

  if (!userId) {
    return {
      ok: false as const,
      response: json(401, { ok: false, error: "Unauthorized" }),
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
      response: json(403, { ok: false, error: "Organization required" }),
    };
  }
}

function toInt(v: unknown) {
  const n = Number(String(v ?? "").trim());
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

function reviewCreditCost() {
  return toInt(process.env.TRUVERN_REVIEW_CREDIT_COST) ?? 1;
}

function upper(v: unknown) {
  return String(v ?? "").trim().toUpperCase();
}

function truthy(v: unknown) {
  if (typeof v === "boolean") return v;
  const s = String(v ?? "").trim().toLowerCase();
  return ["true", "1", "yes", "active", "enabled"].includes(s);
}

function readFirstString(obj: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }

  return null;
}

function hasActiveOverride(org: Record<string, unknown>) {
  const directOverride =
    truthy(org.truvernOpsOverride) ||
    truthy(org.truvernReviewOverride) ||
    truthy(org.truvernOverride) ||
    truthy(org.reviewOverride) ||
    truthy(org.hasTruvernAccess) ||
    truthy(org.hasTruvernReviewAccess);

  if (directOverride) return true;

  const overrideUntil =
    org.truvernOverrideUntil ??
    org.truvernOpsOverrideUntil ??
    org.truvernReviewOverrideUntil ??
    org.reviewOverrideUntil;

  if (typeof overrideUntil === "string" || overrideUntil instanceof Date) {
    const expiresAt = new Date(overrideUntil);
    if (Number.isFinite(expiresAt.getTime()) && expiresAt > new Date()) {
      return true;
    }
  }

  return false;
}

function resolveEligiblePlan(org: Record<string, unknown>) {
  const plan = upper(
    readFirstString(org, [
      "plan",
      "billingPlan",
      "subscriptionPlan",
      "membershipTier",
      "tier",
      "accessTier",
      "customerPlan",
      "organizationPlan",
    ]),
  );

  if (plan === "TRUVERN_UNLIMITED") {
    return plan;
  }

  return null;
}

async function getTruvernAccess(organizationId: number) {
  const requiredCredits = reviewCreditCost();

  const balanceRows: Array<{
    availableCredits: number;
    reservedCredits: number;
    consumedCredits: number;
  }> = await prisma.$queryRawUnsafe(
    `
    select
      coalesce(sum("availableDelta"), 0)::int as "availableCredits",
      coalesce(sum("reservedDelta"), 0)::int as "reservedCredits",
      coalesce(sum("consumedDelta"), 0)::int as "consumedCredits"
    from "TruvernCreditLedgerEntry"
    where "organizationId" = $1
      and status = 'POSTED'::text
    `,
    organizationId,
  );

  const balance = balanceRows[0];

  const availableCredits = Number(balance?.availableCredits ?? 0);
  const reservedCredits = Number(balance?.reservedCredits ?? 0);
  const consumedCredits = Number(balance?.consumedCredits ?? 0);

  const orgRows = await prisma.$queryRaw<OrgJsonRow[]>`
    select to_jsonb(o) as "orgJson"
    from "Organization" o
    where o.id = ${organizationId}
    limit 1
  `;

  const org = orgRows[0]?.orgJson ?? {};
  const eligiblePlan = resolveEligiblePlan(org);
  const override = hasActiveOverride(org);

  return {
    allowed: availableCredits >= requiredCredits || override,
    requiredCredits,
    availableCredits,
    reservedCredits,
    consumedCredits,
    eligiblePlan,
  };
}

export async function POST(req: Request) {
  const gate = await requireApiAuth();

  if (!gate.ok) {
    return gate.response;
  }

  try {
    const body = await req.json().catch(() => ({}));
    const vendorId = toInt(body?.vendorId);

    if (!vendorId) {
      return json(400, {
        ok: false,
        error: "Invalid vendorId",
      });
    }

    if (!("id" in gate.org)) {
      return json(403, {
        ok: false,
        error: "Organization required",
      });
    }

    const organizationId = gate.org.id;

    const vendors = await prisma.$queryRaw<
      Array<{ id: number; organizationId: number }>
    >`
      select id, "organizationId"
      from "Vendor"
      where id = ${vendorId}
        and "organizationId" = ${organizationId}
      limit 1
    `;

    const vendor = vendors[0];

    if (!vendor) {
      return json(404, {
        ok: false,
        error: "Vendor not found",
      });
    }

    const access = await getTruvernAccess(vendor.organizationId);

    if (!access.allowed) {
      return json(402, {
        ok: false,
        code: "TRUVERN_ACCESS_REQUIRED",
        error:
          "Truvern Expert Review requires available Truvern credits or an eligible plan.",
        requiredCredits: access.requiredCredits,
        availableCredits: access.availableCredits,
        reservedCredits: access.reservedCredits,
        consumedCredits: access.consumedCredits,
        eligiblePlan: access.eligiblePlan,
        fundingUrl: "/billing/credits",
      });
    }

    return json(200, {
      ok: true,
      redirectUrl: `/review-desk?vendorId=${vendorId}`,
    });
  } catch (error) {
    return json(500, {
      ok: false,
      error: "Failed to create review intake",
      detail: error instanceof Error ? error.message : "Unknown error",
    });
  }
}


