const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.$queryRawUnsafe(`
    select table_name
    from information_schema.tables
    where table_schema = 'public'
      and table_name in ('AssessmentTemplate','AssessmentSection','AssessmentQuestion')
    order by table_name
  `);

  console.table(rows);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
