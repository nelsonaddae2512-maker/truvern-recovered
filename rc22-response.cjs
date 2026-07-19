const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.reviewResponse.findMany({
    where: {
      reviewAssignmentId: 19,
    },
    orderBy: {
      updatedAt: "desc",
    },
    take: 1,
  });

  console.dir(rows[0], {
    depth: null,
    maxArrayLength: 20,
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
