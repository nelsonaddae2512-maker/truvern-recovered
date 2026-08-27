import { NextResponse } from "next/server";

import { requireOpsAccess } from "@/lib/auth/truvern-governance";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MIGRATION_NAME =
  "20260824051000_add_governance_audit_log";

const EXPECTED_SHA256 =
  "5f031d334b625819bf84f65b9cd22e15bf4e24376d76c552a710fce14fc59ec8";

const MIGRATION_BASE64 =
  "LS0gUkM0MEwuNy1GMTItUjQ2Ry43Ry1ELUEyCi0tIEdlbmVyaWMgbm9uLWJsb2NraW5nIGdvdmVybmFuY2UgYXVkaXQgZXZlbnQgcGVyc2lzdGVuY2UuCgpDUkVBVEUgVEFCTEUgIkF1ZGl0TG9nIiAoCiAgICAiaWQiIFNFUklBTCBOT1QgTlVMTCwKCiAgICAib3JnYW5pemF0aW9uSWQiIElOVEVHRVIsCiAgICAiYWN0b3JVc2VySWQiIFRFWFQsCgogICAgImVudGl0eVR5cGUiIFRFWFQgTk9UIE5VTEwsCiAgICAiZW50aXR5SWQiIFRFWFQgTk9UIE5VTEwsCgogICAgImFjdGlvbiIgVEVYVCBOT1QgTlVMTCwKICAgICJtZXNzYWdlIiBURVhULAoKICAgICJtZXRhZGF0YSIgSlNPTkIgTk9UIE5VTEwgREVGQVVMVCAne30nOjpqc29uYiwKCiAgICAiY3JlYXRlZEF0IiBUSU1FU1RBTVAoMykgTk9UIE5VTEwgREVGQVVMVCBDVVJSRU5UX1RJTUVTVEFNUCwKCiAgICBDT05TVFJBSU5UICJBdWRpdExvZ19wa2V5IgogICAgICAgIFBSSU1BUlkgS0VZICgiaWQiKQopOwoKQ1JFQVRFIElOREVYCiAgICAiQXVkaXRMb2dfZW50aXR5VHlwZV9lbnRpdHlJZF9jcmVhdGVkQXRfaWR4IgpPTgogICAgIkF1ZGl0TG9nIigKICAgICAgICAiZW50aXR5VHlwZSIsCiAgICAgICAgImVudGl0eUlkIiwKICAgICAgICAiY3JlYXRlZEF0IgogICAgKTsKCkNSRUFURSBJTkRFWAogICAgIkF1ZGl0TG9nX29yZ2FuaXphdGlvbklkX2NyZWF0ZWRBdF9pZHgiCk9OCiAgICAiQXVkaXRMb2ciKAogICAgICAgICJvcmdhbml6YXRpb25JZCIsCiAgICAgICAgImNyZWF0ZWRBdCIKICAgICk7CgpDUkVBVEUgSU5ERVgKICAgICJBdWRpdExvZ19hY3RvclVzZXJJZF9jcmVhdGVkQXRfaWR4IgpPTgogICAgIkF1ZGl0TG9nIigKICAgICAgICAiYWN0b3JVc2VySWQiLAogICAgICAgICJjcmVhdGVkQXQiCiAgICApOw==";

const CONFIRMATION =
  "APPLY-AUDITLOG-GOVERNANCE-MIGRATION";

type MigrationRow = {
  migration_name: string;
  checksum: string;
  finished_at: Date | null;
  rolled_back_at: Date | null;
  applied_steps_count: number;
};

type ExistsRow = {
  exists: boolean;
};

function migrationStatements() {
  const sql =
    Buffer.from(
      MIGRATION_BASE64,
      "base64",
    ).toString("utf8");

  return sql
    .split(";")
    .map((statement) =>
      statement.trim(),
    )
    .filter(
      (statement) =>
        statement.length > 0,
    );
}

export async function POST(
  request: Request,
) {
  await requireOpsAccess();

  let input:
    | {
        confirm?: string;
      }
    | null = null;

  try {
    input =
      (await request.json()) as {
        confirm?: string;
      };
  } catch {
    return NextResponse.json(
      {
        ok: false,
        state:
          "INVALID_JSON",
      },
      {
        status: 400,
      },
    );
  }

  if (
    input?.confirm !==
    CONFIRMATION
  ) {
    return NextResponse.json(
      {
        ok: false,
        state:
          "CONFIRMATION_REQUIRED",
      },
      {
        status: 400,
      },
    );
  }

  const existingMigration =
    await prisma.$queryRawUnsafe<
      MigrationRow[]
    >(
      `
        select
          migration_name,
          checksum,
          finished_at,
          rolled_back_at,
          applied_steps_count
        from "_prisma_migrations"
        where migration_name = $1
        limit 1
      `,
      MIGRATION_NAME,
    );

  if (
    existingMigration.length !== 0
  ) {
    return NextResponse.json(
      {
        ok: false,
        state:
          "MIGRATION_ALREADY_RECORDED",
        migration:
          existingMigration[0],
        databaseMutation: false,
        auditMutation: false,
        releaseInvocation: "NONE",
        signingInvocation: "NONE",
      },
      {
        status: 409,
      },
    );
  }

  const auditTable =
    await prisma.$queryRawUnsafe<
      ExistsRow[]
    >(`
      select exists (
        select 1
        from information_schema.tables
        where table_schema = 'public'
          and table_name = 'AuditLog'
      ) as "exists"
    `);

  if (
    auditTable[0]?.exists === true
  ) {
    return NextResponse.json(
      {
        ok: false,
        state:
          "AUDITLOG_ALREADY_EXISTS_WITHOUT_LEDGER",
        databaseMutation: false,
        auditMutation: false,
        releaseInvocation: "NONE",
        signingInvocation: "NONE",
      },
      {
        status: 409,
      },
    );
  }

  const statements =
    migrationStatements();

  if (
    statements.length === 0
  ) {
    return NextResponse.json(
      {
        ok: false,
        state:
          "EMPTY_MIGRATION",
      },
      {
        status: 500,
      },
    );
  }

  try {
    const result =
      await prisma.$transaction(
        async (tx) => {
          for (
            const statement
            of statements
          ) {
            await tx.$executeRawUnsafe(
              statement,
            );
          }

          /*
           * Deliberately do NOT fabricate
           * _prisma_migrations here.
           *
           * Physical schema application and
           * Prisma ledger reconciliation remain
           * separate certified operations.
           */

          return {
            statementCount:
              statements.length,
          };
        },
      );

    return NextResponse.json(
      {
        ok: true,
        state:
          "AUDITLOG_PHYSICAL_SCHEMA_APPLIED",
        migrationName:
          MIGRATION_NAME,
        migrationSha256:
          EXPECTED_SHA256,
        statementCount:
          result.statementCount,
        transaction:
          "COMMITTED",
        ledgerMutation:
          "NONE",
        auditMutation:
          "SCHEMA_ONLY",
        releaseInvocation:
          "NONE",
        signingInvocation:
          "NONE",
      },
      {
        status: 201,
      },
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        state:
          "AUDITLOG_SCHEMA_APPLY_FAILED",
        error:
          error instanceof Error
            ? error.message
            : String(error),
        transaction:
          "ROLLED_BACK_OR_NOT_STARTED",
        ledgerMutation:
          "NONE",
        releaseInvocation:
          "NONE",
        signingInvocation:
          "NONE",
      },
      {
        status: 500,
      },
    );
  }
}