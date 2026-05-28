const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const result = await prisma.truvernFrameworkAssessment.updateMany({
    where: {
      reviewAssignmentId: 67,
    },
    data: {
      title: "NIST 800-53 Truvern NIST 800-53 Governance Review",
    },
  });

  console.log(result);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
