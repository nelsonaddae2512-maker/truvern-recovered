import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireTruvernOperator } from "@/lib/truvern-ops-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function safeInt(v: unknown) {
  const n = Number(String(v ?? "").trim());
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

function safeStr(v: unknown) {
  return typeof v === "string" ? v.trim() : "";
}

function safeTier(v: unknown) {
  const s = safeStr(v).toUpperCase();
  return s === "FREE" || s === "PRO" || s === "ENTERPRISE" ? s : null;
}

function json(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

export async function POST(req: Request) {
  try {
    await requireTruvernOperator();

    const { userId } = await auth();

    const form = await req.formData().catch(() => null);

    const organizationId = safeInt(form?.get("organizationId"));
    const nextTier = safeTier(form?.get("planTier"));
    const reason = safeStr(form?.get("reason")) || "Ops plan override";

    if (!organizationId) {
      return json(400, { ok: false, error: "Missing organizationId" });
    }

    if (!nextTier) {
      return json(400, { ok: false, error: "Invalid plan tier" });
    }

    const result = await prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRawUnsafe<
        Array<{ id: number; name: string; planTier: string }>
      >(
        `
        select id, name, "planTier"::text as "planTier"
        from "Organization"
        where id = $1
        limit 1
        `,
        organizationId,
      );

      const org = rows[0];

      if (!org) {
        return {
          status: 404,
          body: { ok: false, error: "Organization not found" },
        };
      }

      if (org.planTier === nextTier) {
        return {
          status: 200,
          body: {
            ok: true,
            unchanged: true,
            organizationId: org.id,
            planTier: org.planTier,
          },
        };
      }

      await tx.$executeRawUnsafe(
        `
        update "Organization"
        set
          "planTier" = $2::"PlanTier",
          "billingUpdatedAt" = now(),
          "updatedAt" = now()
        where id = $1
        `,
        org.id,
        nextTier,
      );

      const eventKey = `ops:plan-override:${org.id}:${Date.now()}`;

      await tx.$executeRawUnsafe(
        `
        insert into "TruvernCreditLedgerEntry" (
          "organizationId",
          "assessmentRunId",
          "reviewAssignmentId",
          "actorUserId",
          "eventKey",
          "entryType",
          "fundingSource",
          status,
          "availableDelta",
          "reservedDelta",
          "consumedDelta",
          quantity,
          currency,
          "unitPriceCents",
          "amountCents",
          note,
          "metadataJson",
          "createdAt"
        )
        values (
          $1,
          null,
          null,
          $2,
          $3,
          'ADJUSTMENT'::"TruvernCreditEntryType",
          'MANUAL'::"TruvernCreditFundingSource",
          'POSTED'::text,
          0,
          0,
          0,
          0,
          null,
          null,
          null,
          $4,
          $5::jsonb,
          now()
        )
        `,
        org.id,
        userId,
        eventKey,
        `Plan override: ${org.planTier} → ${nextTier}. ${reason}`,
        JSON.stringify({
          source: "truvern_ops_plan_override",
          organizationId: org.id,
          organizationName: org.name,
          previousPlanTier: org.planTier,
          nextPlanTier: nextTier,
          reason,
        }),
      );

      return {
        status: 200,
        body: {
          ok: true,
          organizationId: org.id,
          previousPlanTier: org.planTier,
          planTier: nextTier,
        },
      };
    });

    return NextResponse.redirect(
      new URL(`/truvern/ops/funding/${organizationId}`, req.url),
      { status: 303 },
    );
  } catch (error) {
    return json(500, {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to update plan tier",
    });
  }
}


