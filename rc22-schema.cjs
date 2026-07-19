const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const cols = await prisma.$queryRawUnsafe(`
    SELECT
      table_name,
      column_name
    FROM information_schema.columns
    WHERE table_name IN (
      'ReviewAssignment',
      'ReviewResponse'
    )
    ORDER BY table_name,column_name;
  `);

  console.table(cols);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
