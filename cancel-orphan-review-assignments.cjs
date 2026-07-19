const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const vendorId = 44;

  await prisma.$executeRawUnsafe(`
    insert into "ReviewResponse" ("reviewAssignmentId", "responses", "createdAt", "updatedAt")
    select
      ra.id,
      jsonb_build_object(
        'releaseState', 'CANCELLED',
        'cancelledAt', now()::text,
        'cancellationReason', 'Assessment cancelled from vendor portal lifecycle controls.'
      ),
      now(),
      now()
    from "ReviewAssignment" ra
    left join "ReviewRequest" req on req.id = ra."reviewRequestId"
    where coalesce(req."vendorId", ra."vendorId") = ${vendorId}
      and ra.status::text in ('PENDING', 'IN_PROGRESS', 'SUBMITTED')
      and not exists (
        select 1
        from "ReviewResponse" r
        where r."reviewAssignmentId" = ra.id
      )
  `);

  console.log("Cancelled orphan pending review assignments for vendor", vendorId);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
