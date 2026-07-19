const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.truvernFramework.findMany({
    select: { id: true, slug: true, name: true, version: true },
    orderBy: { id: "asc" },
  });

  console.dir(rows, { depth: null });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
