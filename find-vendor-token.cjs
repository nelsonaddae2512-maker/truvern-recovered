const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const assessment = await prisma.assessment.findFirst({
    where: {
      vendorId: 37,
      token: {
        not: null,
      },
    },
    orderBy: {
      id: "desc",
    },
    select: {
      id: true,
      token: true,
      title: true,
    },
  });

  console.dir(assessment, { depth: null });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
