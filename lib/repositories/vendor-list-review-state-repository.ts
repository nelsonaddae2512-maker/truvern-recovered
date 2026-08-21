import prisma from "@/lib/prisma";

export type VendorListReviewStateRow = {
  vendorId: number;
  assignmentStatus: string | null;
  releaseState: string | null;
  intent: string | null;
};

export async function readLatestVendorReviewStates(
  organizationId: number,
): Promise<VendorListReviewStateRow[]> {
  return prisma.$queryRaw<VendorListReviewStateRow[]>`
    select distinct on (rr."vendorId")
      rr."vendorId"::int as "vendorId",
      ra.status::text as "assignmentStatus",
      coalesce(resp.responses->>'releaseState', '')::text as "releaseState",
      coalesce(resp.responses->>'intent', '')::text as intent
    from "ReviewRequest" rr
    join "ReviewAssignment" ra
      on ra."reviewRequestId" = rr.id
    left join lateral (
      select r.responses
      from "ReviewResponse" r
      where r."reviewAssignmentId" = ra.id
      order by r."updatedAt" desc, r.id desc
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
  `;
}