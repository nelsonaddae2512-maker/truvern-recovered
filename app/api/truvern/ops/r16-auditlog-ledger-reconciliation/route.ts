import { NextResponse } from "next/server";

import { requireOpsAccess } from "@/lib/auth/truvern-governance";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MIGRATION_NAME =
  "20260824051000_add_governance_audit_log";

const MIGRATION_SHA256 =
  "5f031d334b625819bf84f65b9cd22e15bf4e24376d76c552a710fce14fc59ec8";

const CONFIRMATION =
  "RECONCILE-AUDITLOG-MIGRATION-LEDGER";

type MigrationRow = {
  id: string;
  migration_name: string;
  checksum: string;
  finished_at: Date | null;
  rolled_back_at: Date | null;
  applied_steps_count: number;
};

type TableRow = {
  exists: boolean;
};

type ColumnRow = {
  column_name: string;
};

export async function POST(request: Request) {
  await requireOpsAccess();

  const body =
    (await request.json().catch(() => null)) as
      | { confirm?: string }
      | null;

  if (body?.confirm !== CONFIRMATION) {
    return NextResponse.json(
      {
        ok: false,
        state: "CONFIRMATION_REQUIRED",
      },
      {
        status: 400,
      },
    );
  }

  const existing =
    await prisma.$queryRawUnsafe<MigrationRow[]>(`
      select
        id,
        migration_name,
        checksum,
        finished_at,
        rolled_back_at,
        applied_steps_count
      from "_prisma_migrations"
      where migration_name = '${MIGRATION_NAME}'
      limit 1
    `);

  if (existing.length > 0) {
    return NextResponse.json(
      {
        ok: false,
        state: "MIGRATION_ALREADY_RECORDED",
        migration: existing[0],
        databaseMutation: "NONE",
        catalogMutation: "NONE",
        releaseInvocation: "NONE",
        signingInvocation: "NONE",
      },
      {
        status: 409,
      },
    );
  }

  const tableRows =
    await prisma.$queryRawUnsafe<TableRow[]>(`
      select exists (
        select 1
        from information_schema.tables
        where table_schema = 'public'
          and table_name = 'AuditLog'
      ) as "exists"
    `);

  if (tableRows[0]?.exists !== true) {
    return NextResponse.json(
      {
        ok: false,
        state: "AUDITLOG_PHYSICAL_SCHEMA_NOT_CERTIFIED",
        databaseMutation: "NONE",
        releaseInvocation: "NONE",
        signingInvocation: "NONE",
      },
      {
        status: 409,
      },
    );
  }

  const requiredColumns = [
    "organizationId",
    "actorUserId",
    "entityType",
    "entityId",
    "action",
    "message",
    "metadata",
    "createdAt",
  ];

  const columnRows =
    await prisma.$queryRawUnsafe<ColumnRow[]>(`
      select column_name
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'AuditLog'
    `);

  const actualColumns =
    new Set(
      columnRows.map(
        (row) => row.column_name,
      ),
    );

  const missingColumns =
    requiredColumns.filter(
      (column) => !actualColumns.has(column),
    );

  if (missingColumns.length > 0) {
    return NextResponse.json(
      {
        ok: false,
        state: "AUDITLOG_COLUMNS_NOT_CERTIFIED",
        missingColumns,
        databaseMutation: "NONE",
        releaseInvocation: "NONE",
        signingInvocation: "NONE",
      },
      {
        status: 409,
      },
    );
  }

  const id =
    crypto.randomUUID();

  const startedAt =
    new Date();

  await prisma.$executeRaw`
    insert into "_prisma_migrations" (
      "id",
      "checksum",
      "finished_at",
      "migration_name",
      "logs",
      "rolled_back_at",
      "started_at",
      "applied_steps_count"
    )
    values (
      ${id},
      ${MIGRATION_SHA256},
      now(),
      ${MIGRATION_NAME},
      null,
      null,
      ${startedAt},
      1
    )
  `;

  const recorded =
    await prisma.$queryRawUnsafe<MigrationRow[]>(`
      select
        id,
        migration_name,
        checksum,
        finished_at,
        rolled_back_at,
        applied_steps_count
      from "_prisma_migrations"
      where migration_name = '${MIGRATION_NAME}'
      limit 1
    `);

  return NextResponse.json(
    {
      ok: true,
      state: "AUDITLOG_MIGRATION_LEDGER_RECONCILED",
      migration: recorded[0] ?? null,
      physicalSchema: "CERTIFIED",
      ledgerMutation: "RECORDED_AS_APPLIED",
      auditMutation: "NONE",
      catalogMutation: "NONE",
      releaseInvocation: "NONE",
      signingInvocation: "NONE",
    },
    {
      status: 200,
    },
  );
}
