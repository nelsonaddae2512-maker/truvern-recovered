import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireOpsAccess } from "@/lib/auth/truvern-governance";

import {
  getActiveGovernanceSigningKey,
  readGovernancePrivateKey,
  readGovernancePublicKey,
} from "@/lib/governance-signing-keys";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TableRow = {
  exists: boolean;
};

type FrameworkRow = {
  id: number;
  slug: string;
  name: string;
  version: string | null;
};

export async function GET() {
  await requireOpsAccess();

  try {
    /*
     * R16 is deliberately read-only.
     *
     * It resolves the active signing-key metadata and verifies that
     * both key readers can obtain non-empty material, but it NEVER
     * returns or logs the key material.
     *
     * It does not invoke the governance signing operation.
     * It does not write governance audit records.
     * It does NOT create or modify assessments.
     */

    const activeKey =
      await getActiveGovernanceSigningKey();

    const privateKey =
      await readGovernancePrivateKey(activeKey.keyId);

    const publicKey =
      await readGovernancePublicKey(activeKey.keyId);

    const privateKeyReadable =
      typeof privateKey === "string" &&
      privateKey.trim().length > 0;

    const publicKeyReadable =
      typeof publicKey === "string" &&
      publicKey.trim().length > 0;

    /*
     * Physical production audit-table certification.
     * Read-only information_schema query.
     */

    const auditTableRows =
      await prisma.$queryRawUnsafe<TableRow[]>(`
        select exists (
          select 1
          from information_schema.tables
          where table_schema = 'public'
            and table_name = 'AuditLog'
        ) as "exists"
      `);

    const governanceAuditTableExists =
      auditTableRows[0]?.exists === true;

    const auditColumnRows =
      await prisma.$queryRawUnsafe<
        Array<{
          column_name: string;
        }>
      >(`
        select column_name
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'AuditLog'
          and column_name in (
            'organizationId',
            'actorUserId',
            'entityType',
            'entityId',
            'action',
            'message',
            'metadata',
            'createdAt'
          )
      `);

    const requiredAuditColumns = [
      "organizationId",
      "actorUserId",
      "entityType",
      "entityId",
      "action",
      "message",
      "metadata",
      "createdAt",
    ];

    const discoveredAuditColumns =
      new Set(
        auditColumnRows.map(
          row => row.column_name,
        ),
      );

    const missingAuditColumns =
      requiredAuditColumns.filter(
        column =>
          !discoveredAuditColumns.has(column),
      );

    const governanceAuditColumnsReady =
      missingAuditColumns.length === 0;
    const AUDIT_MIGRATION_NAME =
      "20260824051000_add_governance_audit_log";

    const AUDIT_MIGRATION_SHA256 =
      "5f031d334b625819bf84f65b9cd22e15bf4e24376d76c552a710fce14fc59ec8";

    const auditMigrationRows =
      await prisma.$queryRawUnsafe<
        Array<{
          migration_name: string;
          checksum: string;
          finished_at: Date | null;
          rolled_back_at: Date | null;
          applied_steps_count: number;
        }>
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
        AUDIT_MIGRATION_NAME,
      );

    const auditMigration =
      auditMigrationRows[0] ?? null;

    const auditMigrationRecorded =
      auditMigration !== null;

    const auditMigrationHealthy =
      auditMigration !== null &&
      auditMigration.migration_name ===
        AUDIT_MIGRATION_NAME &&
      auditMigration.checksum ===
        AUDIT_MIGRATION_SHA256 &&
      auditMigration.finished_at !== null &&
      auditMigration.rolled_back_at === null;

    /*
     * Permanent OSCAL framework survival check.
     * This is read-only and confirms that the production catalog
     * imported during R14 still exists.
     */

    const frameworks =
      await prisma.$queryRawUnsafe<FrameworkRow[]>(`
        select
          id,
          slug,
          name,
          version
        from "TruvernFramework"
        where slug = 'nist-800-53-rev5'
        limit 2
      `);

    const framework =
      frameworks[0] ?? null;

    const singleCanonicalFramework =
      frameworks.length === 1;

    const certified =
      privateKeyReadable &&
      publicKeyReadable &&
      governanceAuditTableExists &&
      governanceAuditColumnsReady &&
      singleCanonicalFramework &&
      framework !== null;

    return NextResponse.json(
      {
        ok: certified,

        certification:
          "R46G.7G-E7-M.2F-R16",

        state:
          certified
            ? "PRODUCTION_SIGNING_RUNTIME_CERTIFIED"
            : "PRODUCTION_SIGNING_RUNTIME_NOT_CERTIFIED",

        signing: {
          activeKeyResolved:
            activeKey != null,

          keyIdPresent:
            typeof activeKey?.keyId === "string" &&
            activeKey.keyId.length > 0,

          privateKeyReadable,

          publicKeyReadable,

          privateKeyExposed: false,
          publicKeyExposed: false,
          signingInvoked: false,
        },

        governanceAudit: {
          table:
            "AuditLog",

          tableExists:
            governanceAuditTableExists,

          requiredColumns:
            requiredAuditColumns,

          missingColumns:
            missingAuditColumns,

          columnsReady:
            governanceAuditColumnsReady,

          migration: auditMigration
            ? {
                name:
                  auditMigration.migration_name,

                checksum:
                  auditMigration.checksum,

                finished:
                  auditMigration.finished_at !== null,

                rolledBack:
                  auditMigration.rolled_back_at !== null,

                appliedSteps:
                  Number(
                    auditMigration.applied_steps_count,
                  ),
              }
            : null,

          migrationExpectedSha256:
            AUDIT_MIGRATION_SHA256,

          migrationRecorded:
            auditMigrationRecorded,

          migrationHealthy:
            auditMigrationHealthy,

          writePerformed: false,
        },

        framework: framework
          ? {
              id: framework.id,
              slug: framework.slug,
              name: framework.name,
              version: framework.version,
              singleCanonicalFramework,
            }
          : null,

        mutations: {
          assessmentCreated: false,
          assessmentUpdated: false,
          auditWritten: false,
          releaseInvoked: false,
          signingInvoked: false,
        },
      },
      {
        status: certified ? 200 : 409,
      }
    );
  }
  catch (error) {
    console.error(
      "R16 signing runtime certification failed",
      error instanceof Error
        ? error.message
        : "Unknown error"
    );

    return NextResponse.json(
      {
        ok: false,
        certification:
          "R46G.7G-E7-M.2F-R16",
        state:
          "PRODUCTION_SIGNING_RUNTIME_CERTIFICATION_FAILED",

        /*
         * Do not serialize the thrown object because key-provider
         * errors can contain implementation/environment details.
         */
        error:
          error instanceof Error
            ? error.message
            : "Unknown runtime failure",

        mutations: {
          assessmentCreated: false,
          assessmentUpdated: false,
          auditWritten: false,
          releaseInvoked: false,
          signingInvoked: false,
        },
      },
      {
        status: 500,
      }
    );
  }
}

