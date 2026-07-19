const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.$queryRawUnsafe(`
    select
      id,
      "reviewAssignmentId",
      "reviewRequestId",
      "organizationId",
      responses,
      "createdAt",
      "updatedAt",
      "submittedAt",
      "draftSavedAt"
    from "ReviewResponse"
    where "reviewAssignmentId" = $1
    order by "updatedAt" desc nulls last
    limit 1
  `, 19);

  console.dir(rows[0], {
    depth: null,
    maxArrayLength: 30,
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
