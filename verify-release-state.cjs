const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.$queryRawUnsafe(`
    select
      ra.id,
      ra.status,
      rr.responses->>'releaseState' as "releaseState",
      rr.responses->>'releasedAt' as "releasedAt",
      rr.responses->>'confirmedAt' as "confirmedAt"
    from "ReviewAssignment" ra
    left join "ReviewResponse" rr
      on rr."reviewAssignmentId" = ra.id
    where ra.id = 67
  `);

  console.dir(rows, { depth: null });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
