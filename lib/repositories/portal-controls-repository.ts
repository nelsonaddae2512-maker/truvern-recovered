import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";

type PortalControlsClient = Pick<
  Prisma.TransactionClient,
  "$executeRaw"
>;

export async function cancelLatestReviewResponsesForVendor(
  vendorId: number,
  client: PortalControlsClient = prisma,
) {
  return client.$executeRaw`
    update "ReviewResponse" rr
    set responses =
      coalesce(rr.responses, '{}'::jsonb)
      || jsonb_build_object(
        'releaseState', 'CANCELLED',
        'cancelledAt', now()::text,
        'cancellationReason',
        'Assessment cancelled from vendor portal lifecycle controls.'
      )
    where rr.id in (
      select latest.id
      from "ReviewAssignment" ra
      join lateral (
        select r.id
        from "ReviewResponse" r
        where r."reviewAssignmentId" = ra.id
        order by r."updatedAt" desc, r.id desc
        limit 1
      ) latest on true
      left join "ReviewRequest" req
        on req.id = ra."reviewRequestId"
      where coalesce(req."vendorId", ra."vendorId") = ${vendorId}
        and ra.status::text in (
          'PENDING',
          'IN_PROGRESS',
          'SUBMITTED'
        )
    )
  `;
}