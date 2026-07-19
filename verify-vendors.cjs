const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const vendors = await prisma.vendor.findMany({
    orderBy: {
      id: "desc",
    },
    take: 10,
    select: {
      id: true,
      name: true,
      organizationId: true,
      tier: true,
      createdAt: true,
    },
  });

  console.dir(vendors, { depth: null });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
