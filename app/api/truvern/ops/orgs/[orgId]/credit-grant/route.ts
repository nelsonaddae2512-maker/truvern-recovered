import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createOrgNotification } from "@/lib/notifications/create-notification";
import { findOrganization } from "@/lib/repositories/organization-repository";

import { createTruvernCreditLedgerEntry } from "@/lib/repositories/review-credit-ledger-repository";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type Params = {
  params: Promise<{ orgId: string }>;
};

type BodyMap = Record<string, unknown>;

function isOpsUser(userId: string | null | undefined) {
  if (!userId) return false;

  const allowlist = String(process.env.TRUVERN_OPS_USERS || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  return allowlist.includes(userId);
}

async function readBody(request: Request): Promise<BodyMap> {
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return request.json().catch(() => ({}));
  }

  const formData = await request.formData().catch(() => null);

  if (!formData) return {};

  return Object.fromEntries(formData.entries());
}

function redirectBack(request: Request, organizationId: number, status: string) {
  return NextResponse.redirect(
    new URL(`/truvern/ops/funding/${organizationId}?status=${status}`, request.url),
    303,
  );
}

export async function POST(request: Request, context: Params) {
  const { userId } = await auth();

  const { orgId } = await context.params;
  const organizationId = Number(orgId);

  if (!isOpsUser(userId)) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized ops user." },
      { status: 403 },
    );
  }

  if (!Number.isInteger(organizationId) || organizationId <= 0) {
    return NextResponse.json(
      { ok: false, error: "Invalid organization id." },
      { status: 400 },
    );
  }

  const body = await readBody(request);
  const amount = Number(body.amount);
  const reason = String(body.reason || "Pilot credit grant").trim();

  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json(
      { ok: false, error: "Credit amount must be greater than zero." },
      { status: 400 },
    );
  }

  const organization = await findOrganization({
    where: { id: organizationId },
    select: { id: true, name: true },
  });

  if (!organization) {
    return NextResponse.json(
      { ok: false, error: "Organization not found." },
      { status: 404 },
    );
  }

  const eventKey = `ops-grant:${organizationId}:${Date.now()}`;
  const now = new Date();

  await createTruvernCreditLedgerEntry({
    data: {
      organizationId,
      entryType: "GRANT",
      status: "POSTED",
      fundingSource: "PROMOTIONAL",
      availableDelta: amount,
      reservedDelta: 0,
      consumedDelta: 0,
      eventKey,
      note: reason,
      createdAt: now,
      updatedAt: now,
    },
  });
await createOrgNotification({
    organizationId,
    type: "CREDITS_GRANTED",
    severity: "SUCCESS",
    title: "Credits granted",
    message: `${amount} Truvern credits were granted to this organization.`,
    href: `/billing/credits`,
    metadataJson: {
      organizationId,
      credits: amount,
      reason,
      source: "truvern_ops",
    },
  });

  return redirectBack(request, organizationId, "credits-granted");
}






