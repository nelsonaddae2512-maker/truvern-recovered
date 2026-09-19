import { NextResponse } from "next/server";

import { requireOpsAccess } from "@/lib/auth/truvern-governance";
import { governanceAuthErrorResponse } from "@/lib/auth/governance-auth-errors";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const PROVIDER_BUDGET_EVENT_KIND =
  "AI_REMEDIATION_PROVIDER_ATTEMPT_RESERVED";

type DatabaseIdentityRow = {
  databaseName: string;
  schemaName: string;
  serverVersion: string;
};

type UsageEventTableRow = {
  tableName: string | null;
};

type UsageEventColumnRow = {
  columnName: string;
  dataType: string;
  nullable: string;
  columnDefault: string | null;
};

type CountRow = {
  count: bigint;
};

type QueueRow = {
  status: string;
  assignedTo: string | null;
  count: bigint;
};

type TaskStateRow = {
  id: number;
  packageId: number | null;
  status: string;
  assignedTo: string | null;
};

export async function GET() {
  try {
    await requireOpsAccess();

    const databaseRows =
      await prisma.$queryRaw<DatabaseIdentityRow[]>`
        select
          current_database() as "databaseName",
          current_schema() as "schemaName",
          version() as "serverVersion"
      `;

    const usageEventTableRows =
      await prisma.$queryRaw<UsageEventTableRow[]>`
        select
          to_regclass('"UsageEvent"')::text as "tableName"
      `;

    const usageEventColumnRows =
      await prisma.$queryRaw<UsageEventColumnRow[]>`
        select
          column_name as "columnName",
          data_type as "dataType",
          is_nullable as "nullable",
          column_default as "columnDefault"
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'UsageEvent'
        order by ordinal_position asc
      `;

    const providerBudgetRows =
      await prisma.$queryRaw<CountRow[]>`
        select count(*)::bigint as count
        from "UsageEvent"
        where kind = ${PROVIDER_BUDGET_EVENT_KIND}
          and "createdAt" >= now() - interval '24 hours'
      `;

    const queueRows =
      await prisma.$queryRaw<QueueRow[]>`
        select
          status::text as status,
          "assignedTo"::text as "assignedTo",
          count(*)::bigint as count
        from "WorkflowTask"
        where type::text = 'AI_PRE_REVIEW'
        group by status, "assignedTo"
        order by status, "assignedTo" nulls first
      `;

    const blockerRows =
      await prisma.$queryRaw<CountRow[]>`
        select count(*)::bigint as count
        from "WorkflowTask"
        where type::text = 'AI_PRE_REVIEW'
          and status::text = 'IN_PROGRESS'
          and "assignedTo"::text in (
            'AI_WORKER',
            'TRUVERN_AI_RECOVERY'
          )
      `;

    const lockedCanaryRows =
      await prisma.$queryRaw<TaskStateRow[]>`
        select
          id,
          "packageId",
          status::text as status,
          "assignedTo"::text as "assignedTo"
        from "WorkflowTask"
        where id = 18
          and "packageId" = 31
        limit 1
      `;

    const providerReservationCount =
      Number(providerBudgetRows[0]?.count ?? 0n);

    const blockerCount =
      Number(blockerRows[0]?.count ?? 0n);

    return NextResponse.json(
      {
        ok: true,
        certification: "R22.7F.10CE-R255I58K.1",
        state: "PRODUCTION_DB_READ_ONLY_CERTIFIED",

        database: {
          name: databaseRows[0]?.databaseName ?? null,
          schema: databaseRows[0]?.schemaName ?? null,
          serverVersion:
            databaseRows[0]?.serverVersion ?? null,
          credentialsExposed: false,
        },

        usageEvent: {
          table:
            usageEventTableRows[0]?.tableName ?? null,
          columns: usageEventColumnRows,
        },

        providerBudget: {
          eventKind:
            PROVIDER_BUDGET_EVENT_KIND,
          rollingWindowHours: 24,
          maximumReservations: 1,
          reservationCount:
            providerReservationCount,
          exhausted:
            providerReservationCount >= 1,
        },

        aiPreReview: {
          queue:
            queueRows.map((row) => ({
              status: row.status,
              assignedTo: row.assignedTo,
              count: Number(row.count),
            })),
          globalBlockerCount:
            blockerCount,
          globalBlockerPresent:
            blockerCount > 0,
        },

        lockedCanary: {
          taskId: 18,
          packageId: 31,
          state:
            lockedCanaryRows[0] ?? null,
          retryPermitted: false,
        },

        operations: {
          databaseConnection: true,
          databaseQueries: true,
          databaseMutation: false,
          storageOperation: false,
          workerInvocation: false,
          providerInvocation: false,
          modelInvocation: false,
          canaryInvocation: false,
        },
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    const authError =
      governanceAuthErrorResponse(error);

    if (authError) {
      return authError;
    }

    return NextResponse.json(
      {
        ok: false,
        certification: "R22.7F.10CE-R255I58K.1",
        state:
          "PRODUCTION_DB_READ_ONLY_CERTIFICATION_FAILED",
        error:
          error instanceof Error
            ? error.message
            : String(error),

        operations: {
          databaseMutation: false,
          storageOperation: false,
          workerInvocation: false,
          providerInvocation: false,
          modelInvocation: false,
          canaryInvocation: false,
        },
      },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }
}