const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.truvernFrameworkAssessment.findMany({
    orderBy: { updatedAt: "desc" },
    take: 10,
    select: {
      id: true,
      vendorId: true,
      reviewAssignmentId: true,
      title: true,
      status: true,
      updatedAt: true,
    },
  });

  console.dir(rows, { depth: null });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
