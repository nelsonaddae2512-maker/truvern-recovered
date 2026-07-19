const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.$queryRawUnsafe(`
    select
      ra.id as "assignmentId",
      v.name as "vendorName",
      rr.responses->>'releaseState' as "releaseState",
      rr.responses->>'decision' as decision,
      rr.responses->>'confirmedAt' as "confirmedAt"
    from "ReviewAssignment" ra
    join "Vendor" v
      on v.id = ra."vendorId"
    join "ReviewResponse" rr
      on rr."reviewAssignmentId" = ra.id
    where upper(v.name) like '%PROGRESSIVE%'
    order by ra.id desc
  `);

  console.dir(rows, { depth: null });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
