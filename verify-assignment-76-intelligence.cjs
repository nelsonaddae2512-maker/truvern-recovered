const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const assignmentId = 76;

  const assignment = await prisma.$queryRawUnsafe(`
    select *
    from "ReviewAssignment"
    where id = $1
    limit 1
  `, assignmentId);

  const responses = await prisma.$queryRawUnsafe(`
    select
      id,
      "reviewAssignmentId",
      responses,
      "updatedAt"
    from "ReviewResponse"
    where "reviewAssignmentId" = $1
    order by "updatedAt" desc, id desc
    limit 3
  `, assignmentId);

  console.log("ASSIGNMENT");
  console.dir(assignment, { depth: null });

  console.log("RESPONSES");
  console.dir(responses, { depth: null });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
