const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.$queryRawUnsafe(`
    select distinct status
    from "ReviewAssignment"
    order by status
  `);

  console.dir(rows, { depth: null });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
