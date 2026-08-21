import prisma from "@/lib/prisma";

export type GovernanceHealthRow = {
  assignmentId: number;
  vendorName: string | null;
  updatedAt: Date | string | null;
  manifestId: number | null;
};

export async function readGovernanceHealthRows(): Promise<
  GovernanceHealthRow[]
> {
  return prisma.$queryRaw<GovernanceHealthRow[]>`
    select
      ra.id as "assignmentId",
      v.name as "vendorName",
      ra."updatedAt",
      gm.id as "manifestId"

    from "ReviewAssignment" ra

    left join "ReviewRequest" rr
      on rr.id = ra."reviewRequestId"

    left join "Vendor" v
      on v.id = rr."vendorId"

    left join lateral (
      select
        id,
        responses
      from "ReviewResponse"
      where "reviewAssignmentId" = ra.id
      order by "updatedAt" desc
      limit 1
    ) latest on true

    left join "GovernanceReleaseManifest" gm
      on gm."reviewResponseId" = latest.id

    where
      upper(
        coalesce(
          latest.responses->>'releaseState',
          ''
        )
      ) = 'CONFIRMED'

    order by ra."updatedAt" asc

    limit 100
  `;
}