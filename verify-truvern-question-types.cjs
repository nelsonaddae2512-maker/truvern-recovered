const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.assessmentQuestion.groupBy({
    by: ["type"],
    _count: {
      _all: true,
    },
    where: {
      template: {
        name: "Truvern NIST 800-53 Governance Review",
      },
    },
  });

  console.dir(rows, { depth: null });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
