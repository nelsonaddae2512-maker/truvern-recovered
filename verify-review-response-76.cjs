const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const assignmentId = 76;

  const rows = await prisma.$queryRawUnsafe(`
    select
      id,
      "reviewAssignmentId",
      responses,
      "createdAt",
      "updatedAt"
    from "ReviewResponse"
    where "reviewAssignmentId" = $1
    order by "updatedAt" desc, id desc
    limit 5
  `, assignmentId);

  console.dir(rows, { depth: null });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
