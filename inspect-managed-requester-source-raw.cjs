const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const assignment = await prisma.$queryRawUnsafe(`
    select *
    from "ReviewAssignment"
    where id = 67
    limit 1
  `);

  const request = await prisma.$queryRawUnsafe(`
    select *
    from "AssessmentReviewRequest"
    where id = 73
    limit 1
  `);

  const assessment = await prisma.truvernFrameworkAssessment.findUnique({
    where: { id: 10 },
  });

  console.log("ASSIGNMENT");
  console.dir(assignment, { depth: null });

  console.log("REQUEST");
  console.dir(request, { depth: null });

  console.log("ASSESSMENT");
  console.dir(assessment, { depth: null });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
