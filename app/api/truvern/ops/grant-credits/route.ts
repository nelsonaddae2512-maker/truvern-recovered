import { NextResponse } from "next/server";
import { requireTruvernOperator } from "@/lib/truvern-ops-access";
import {
  insertOpsCreditGrant,
  readOpsCreditBalance,
  readOpsCreditGrantOrganization,
} from "@/lib/repositories/ops-credit-grant-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function safeStr(v: unknown) {
  return typeof v === "string" ? v.trim() : "";
}

function safeInt(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.floor(n) : 0;
}

export async function POST(req: Request) {
  try {
    await requireTruvernOperator();

    const contentType = req.headers.get("content-type") || "";
    let body: any;

    if (contentType.includes("application/json")) {
      body = await req.json();
    } else {
      const form = await req.formData();

      body = {
        organizationId: form.get("organizationId"),
        credits: form.get("credits"),
        reason: form.get("reason"),
      };
    }

    const organizationId = safeInt(body?.organizationId);
    const credits = safeInt(body?.credits);
    const reason = safeStr(body?.reason) || "Legacy ops credit grant";

    if (!organizationId) {
      return NextResponse.json(
        { ok: false, error: "organizationId is required." },
        { status: 400, headers: { "cache-control": "no-store" } },
      );
    }

    if (!credits || credits <= 0) {
      return NextResponse.json(
        { ok: false, error: "credits must be greater than 0." },
        { status: 400, headers: { "cache-control": "no-store" } },
      );
    }

    const orgRows =
      await readOpsCreditGrantOrganization(organizationId);

    const org = orgRows?.[0];

    if (!org) {
      return NextResponse.json(
        { ok: false, error: "Organization not found." },
        { status: 404, headers: { "cache-control": "no-store" } },
      );
    }

    const eventKey = `legacy-ops-grant:${organizationId}:${Date.now()}`;

    await insertOpsCreditGrant({
      organizationId,
      credits,
      reason,
      eventKey,
    });

    const balanceRows = await readOpsCreditBalance(organizationId);

    return NextResponse.json(
      {
        ok: true,
        organizationId,
        organizationName: org.name || null,
        grantedCredits: credits,
        balance: {
          available: safeInt(balanceRows?.[0]?.availableCredits),
          reserved: safeInt(balanceRows?.[0]?.reservedCredits),
          consumed: safeInt(balanceRows?.[0]?.consumedCredits),
        },
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: safeStr(error?.message) || "Failed to grant Truvern credits.",
      },
      { status: 500, headers: { "cache-control": "no-store" } },
    );
  }
}


