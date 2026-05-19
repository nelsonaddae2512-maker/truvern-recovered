const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe(`
    alter table "AssessmentRun"
    add column if not exists "assessmentId" integer;
  `);

  await prisma.$executeRawUnsafe(`
    create index if not exists "AssessmentRun_assessmentId_idx"
    on "AssessmentRun"("assessmentId");
  `);

  const rows = await prisma.$queryRawUnsafe(`
    select column_name
    from information_schema.columns
    where table_name = 'AssessmentRun'
    order by column_name
  `);

  console.table(rows);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
