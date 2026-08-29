import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";

export const vendorWorkflowStages = [
  "Intake",
  "Submission",
  "Review",
  "Remediation",
  "Release",
] as const;

export type VendorWorkflowStage =
  (typeof vendorWorkflowStages)[number];

export type VendorListReviewStateRow = {
  vendorId: number;
  assignmentStatus: string | null;
  releaseState: string | null;
  intent: string | null;
};

export type VendorPortfolioRow = {
  vendorId: number;
  stage: VendorWorkflowStage;
};

export type VendorPortfolioStageCounts =
  Record<VendorWorkflowStage, number>;

function emptyStageCounts(): VendorPortfolioStageCounts {
  return {
    Intake: 0,
    Submission: 0,
    Review: 0,
    Remediation: 0,
    Release: 0,
  };
}

function normalizeStage(
  value: string,
): VendorWorkflowStage {
  const match =
    vendorWorkflowStages.find(
      (stage) =>
        stage === value,
    );

  return match ?? "Intake";
}

function portfolioCtes(
  organizationId: number,
) {
  return Prisma.sql`
    latest_review as (
      select distinct on (rr."vendorId")
        rr."vendorId"::int as "vendorId",
        ra.status::text as "assignmentStatus",
        coalesce(
          resp.responses->>'releaseState',
          ''
        )::text as "releaseState",
        coalesce(
          resp.responses->>'intent',
          ''
        )::text as intent
      from "ReviewRequest" rr
      join "ReviewAssignment" ra
        on ra."reviewRequestId" = rr.id
      left join lateral (
        select r.responses
        from "ReviewResponse" r
        where r."reviewAssignmentId" = ra.id
        order by
          r."updatedAt" desc,
          r.id desc
        limit 1
      ) resp on true
      where rr."organizationId" = ${organizationId}
        and resp.responses is not null
        and coalesce(
          resp.responses->>'releaseState',
          ''
        ) not in (
          'ARCHIVED',
          'CANCELLED',
          'CANCELED'
        )
      order by
        rr."vendorId",
        ra."updatedAt" desc,
        ra.id desc
    ),

    latest_assessment as (
      select distinct on (a."vendorId")
        a."vendorId"::int as "vendorId",
        a.id::int as "assessmentId",
        a.status::text as status,
        a."isVendorSubmitted",
        a."submittedAt"
      from "Assessment" a
      join "Vendor" av
        on av.id = a."vendorId"
      where av."organizationId" = ${organizationId}
        and a.status::text not in (
          'ARCHIVED',
          'RELEASED',
          'COMPLETED'
        )
      order by
        a."vendorId",
        a."updatedAt" desc,
        a.id desc
    ),

    evidence_counts as (
      select
        e."vendorId"::int as "vendorId",
        count(*)::int as "evidenceCount"
      from "Evidence" e
      join "Vendor" ev
        on ev.id = e."vendorId"
      where ev."organizationId" = ${organizationId}
      group by e."vendorId"
    ),

    issue_counts as (
      select
        i."vendorId"::int as "vendorId",
        count(*)::int as "issueCount"
      from "Issue" i
      join "Vendor" iv
        on iv.id = i."vendorId"
      where iv."organizationId" = ${organizationId}
      group by i."vendorId"
    ),

    classified as (
      select
        v.id::int as "vendorId",
        v.name,
        v."contactName",
        v."contactEmail",
        v.website,
        v."updatedAt",

        case
          when upper(
            coalesce(
              lr."releaseState",
              ''
            )
          ) in (
            'RELEASED',
            'CONFIRMED'
          )
            then 'Release'

          when upper(
            coalesce(
              lr."releaseState",
              ''
            )
          ) in (
            'COMPLETED',
            'READY_FOR_RELEASE'
          )
          or upper(
            coalesce(
              lr."assignmentStatus",
              ''
            )
          ) = 'COMPLETED'
            then 'Remediation'

          when upper(
            coalesce(
              lr."assignmentStatus",
              ''
            )
          ) in (
            'IN_PROGRESS',
            'CLAIMED',
            'SUBMITTED'
          )
            then 'Review'

          when coalesce(
            ic."issueCount",
            0
          ) > 0
            then 'Remediation'

          when la."assessmentId" is not null
            and (
              coalesce(
                la."isVendorSubmitted",
                false
              ) = true
              or la."submittedAt" is not null
              or upper(
                coalesce(
                  la.status,
                  ''
                )
              ) like '%SUBMITTED%'
            )
            then 'Review'

          when la."assessmentId" is not null
            and coalesce(
              ec."evidenceCount",
              0
            ) <= 0
            then 'Submission'

          when la."assessmentId" is not null
            and coalesce(
              ec."evidenceCount",
              0
            ) > 0
            then 'Review'

          else 'Intake'
        end::text as stage

      from "Vendor" v

      left join latest_review lr
        on lr."vendorId" = v.id

      left join latest_assessment la
        on la."vendorId" = v.id

      left join evidence_counts ec
        on ec."vendorId" = v.id

      left join issue_counts ic
        on ic."vendorId" = v.id

      where v."organizationId" = ${organizationId}
        and v."deletedAt" is null
    )
  `;
}

function portfolioFilter(
  q: string,
  stage: VendorWorkflowStage | null,
) {
  const filters: Prisma.Sql[] = [];

  const search =
    q.trim().slice(0, 200);

  if (search) {
    const pattern =
      `%${search}%`;

    filters.push(
      Prisma.sql`(
        name ilike ${pattern}
        or coalesce(
          "contactName",
          ''
        ) ilike ${pattern}
        or coalesce(
          "contactEmail",
          ''
        ) ilike ${pattern}
        or coalesce(
          website,
          ''
        ) ilike ${pattern}
      )`,
    );
  }

  if (stage) {
    filters.push(
      Prisma.sql`
        stage = ${stage}
      `,
    );
  }

  if (filters.length === 0) {
    return Prisma.empty;
  }

  return Prisma.sql`
    where ${Prisma.join(
      filters,
      " and ",
    )}
  `;
}

export async function readLatestVendorReviewStates(
  organizationId: number,
  vendorIds?: number[],
): Promise<VendorListReviewStateRow[]> {
  const vendorFilter =
    vendorIds === undefined
      ? Prisma.empty
      : vendorIds.length === 0
        ? Prisma.sql`and 1 = 0`
        : Prisma.sql`
            and rr."vendorId" in (
              ${Prisma.join(vendorIds)}
            )
          `;

  return prisma.$queryRaw<
    VendorListReviewStateRow[]
  >`
    select distinct on (rr."vendorId")
      rr."vendorId"::int as "vendorId",
      ra.status::text as "assignmentStatus",
      coalesce(
        resp.responses->>'releaseState',
        ''
      )::text as "releaseState",
      coalesce(
        resp.responses->>'intent',
        ''
      )::text as intent

    from "ReviewRequest" rr

    join "ReviewAssignment" ra
      on ra."reviewRequestId" = rr.id

    left join lateral (
      select r.responses
      from "ReviewResponse" r
      where r."reviewAssignmentId" = ra.id
      order by
        r."updatedAt" desc,
        r.id desc
      limit 1
    ) resp on true

    where rr."organizationId" = ${organizationId}
      and resp.responses is not null
      and coalesce(
        resp.responses->>'releaseState',
        ''
      ) not in (
        'ARCHIVED',
        'CANCELLED',
        'CANCELED'
      )
      ${vendorFilter}

    order by
      rr."vendorId",
      ra."updatedAt" desc,
      ra.id desc
  `;
}

export async function readVendorPortfolioStageCounts(
  organizationId: number,
): Promise<VendorPortfolioStageCounts> {
  const rows =
    await prisma.$queryRaw<
      Array<{
        stage: string;
        count: bigint;
      }>
    >`
      with ${portfolioCtes(
        organizationId,
      )}

      select
        stage,
        count(*)::bigint as count
      from classified
      group by stage
    `;

  const result =
    emptyStageCounts();

  for (const row of rows) {
    const stage =
      normalizeStage(
        row.stage,
      );

    result[stage] =
      Number(row.count);
  }

  return result;
}

export async function readVendorPortfolioPage(
  input: {
    organizationId: number;
    q?: string;
    stage?: VendorWorkflowStage | null;
    page?: number;
    pageSize?: number;
  },
): Promise<{
  rows: VendorPortfolioRow[];
  total: number;
}> {
  const organizationId =
    input.organizationId;

  const q =
    String(input.q ?? "")
      .trim()
      .slice(0, 200);

  const stage =
    input.stage ?? null;

  const page =
    Math.max(
      1,
      Math.trunc(
        input.page ?? 1,
      ),
    );

  const pageSize =
    Math.max(
      10,
      Math.min(
        100,
        Math.trunc(
          input.pageSize ?? 50,
        ),
      ),
    );

  const offset =
    (page - 1) * pageSize;

  const filter =
    portfolioFilter(
      q,
      stage,
    );

  const [
    countRows,
    pageRows,
  ] =
    await Promise.all([
      prisma.$queryRaw<
        Array<{
          count: bigint;
        }>
      >`
        with ${portfolioCtes(
          organizationId,
        )}

        select
          count(*)::bigint as count
        from classified
        ${filter}
      `,

      prisma.$queryRaw<
        Array<{
          vendorId: number;
          stage: string;
        }>
      >`
        with ${portfolioCtes(
          organizationId,
        )}

        select
          "vendorId",
          stage
        from classified
        ${filter}
        order by
          "updatedAt" desc,
          "vendorId" desc
        limit ${pageSize}
        offset ${offset}
      `,
    ]);

  return {
    total:
      Number(
        countRows[0]?.count ?? 0,
      ),

    rows:
      pageRows.map(
        (row) => ({
          vendorId:
            Number(row.vendorId),

          stage:
            normalizeStage(
              row.stage,
            ),
        }),
      ),
  };
}
