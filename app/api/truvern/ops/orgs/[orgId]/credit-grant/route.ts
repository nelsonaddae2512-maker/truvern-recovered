import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { createOrgNotification } from "@/lib/notifications/create-notification";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type Params = {
  params: Promise<{ orgId: string }>;
};

type ColumnRow = {
  column_name: string;
  is_nullable?: string;
  column_default?: string | null;
  data_type?: string;
  udt_name?: string;
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

function sqlValue(value: unknown) {
  if (value === null || value === undefined) return "NULL";

  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "NULL";
    return String(value);
  }

  if (value instanceof Date) {
    return `'${value.toISOString().replace(/'/g, "''")}'`;
  }

  return `'${String(value).replace(/'/g, "''")}'`;
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

async function getTableColumns(tableName: string) {
  const rows = await prisma.$queryRaw<ColumnRow[]>`
    SELECT column_name, is_nullable, column_default, data_type, udt_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = ${tableName}
  `;

  return rows;
}

function buildRequiredDefaults(columns: ColumnRow[]) {
  const defaults: Record<string, unknown> = {};

  for (const column of columns) {
    const name = column.column_name;
    const dataType = String(column.data_type || "").toLowerCase();
    const udtName = String(column.udt_name || "").toLowerCase();

    if (
      column.is_nullable === "NO" &&
      !column.column_default &&
      name !== "id"
    ) {
      if (name.endsWith("Delta")) defaults[name] = 0;
      else if (dataType.includes("integer") || dataType.includes("numeric") || udtName.includes("int")) defaults[name] = 0;
      else if (dataType.includes("boolean")) defaults[name] = false;
      else if (dataType.includes("timestamp")) defaults[name] = new Date();
      else if (name === "entryType") defaults[name] = "GRANT";
      else if (name === "status") defaults[name] = "POSTED";
      else if (name === "fundingSource") defaults[name] = "PROMOTIONAL";
      else if (name === "createdAt" || name === "updatedAt") defaults[name] = new Date();
      else defaults[name] = "ops-grant";
    }
  }

  return defaults;
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

  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, name: true },
  });

  if (!organization) {
    return NextResponse.json(
      { ok: false, error: "Organization not found." },
      { status: 404 },
    );
  }

  const columnRows = await getTableColumns("TruvernCreditLedgerEntry");
  const columns = new Set(columnRows.map((row) => row.column_name));

  if (columns.size === 0) {
    return NextResponse.json(
      { ok: false, error: "TruvernCreditLedgerEntry table was not found." },
      { status: 500 },
    );
  }

  const eventKey = `ops-grant:${organizationId}:${Date.now()}`;
  const now = new Date();

  const insert: Record<string, unknown> = {
    ...buildRequiredDefaults(columnRows),
    organizationId,
    entryType: "GRANT",
    status: "POSTED",
    fundingSource: "PROMOTIONAL",
    availableDelta: amount,
    reservedDelta: 0,
    consumedDelta: 0,
    eventKey,
    reason,
    note: reason,
    description: reason,
    createdByUserId: userId,
    actorUserId: userId,
    createdAt: now,
    updatedAt: now,
  };

  const selected = Object.entries(insert).filter(([key]) => columns.has(key));

  const columnSql = selected.map(([key]) => `"${key}"`).join(", ");
  const valueSql = selected.map(([, value]) => sqlValue(value)).join(", ");

  await prisma.$executeRawUnsafe(
    `INSERT INTO "TruvernCreditLedgerEntry" (${columnSql}) VALUES (${valueSql})`,
  );

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






