const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.$queryRawUnsafe(`
    select column_name
    from information_schema.columns
    where table_name in ('Assessment','AssessmentRun')
    order by table_name, column_name
  `);

  console.table(rows);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
