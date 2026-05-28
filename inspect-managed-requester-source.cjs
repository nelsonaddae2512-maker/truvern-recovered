const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const assignment = await prisma.reviewAssignment.findUnique({
    where: { id: 67 },
  });

  const assessment = await prisma.truvernFrameworkAssessment.findUnique({
    where: { id: 10 },
  });

  const vendor = assessment?.vendorId
    ? await prisma.vendor.findUnique({ where: { id: assessment.vendorId } })
    : null;

  console.log("ASSIGNMENT");
  console.dir(assignment, { depth: null });

  console.log("ASSESSMENT");
  console.dir(assessment, { depth: null });

  console.log("VENDOR");
  console.dir(vendor, { depth: null });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
