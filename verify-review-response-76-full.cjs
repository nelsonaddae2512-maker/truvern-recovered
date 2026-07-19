const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const assignmentId = 76;

  const responses = await prisma.$queryRawUnsafe(`
    select
      id,
      "reviewAssignmentId",
      responses,
      "createdAt",
      "updatedAt"
    from "ReviewResponse"
    where "reviewAssignmentId" = $1
    order by id desc
  `, assignmentId);

  console.log("");
  console.log("RESPONSE COUNT:", responses.length);
  console.log("");

  console.dir(responses, {
    depth: null,
    maxArrayLength: null,
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
