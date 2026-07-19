const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const statements = [
    `alter table "Assessment" add column if not exists "startedAt" timestamp(3);`,
    `alter table "Assessment" add column if not exists "submittedAt" timestamp(3);`,
    `alter table "Assessment" add column if not exists "completedAt" timestamp(3);`,
    `alter table "Assessment" add column if not exists "reopenedAt" timestamp(3);`,
    `alter table "Assessment" add column if not exists "archivedAt" timestamp(3);`,
    `alter table "Assessment" add column if not exists "score" integer;`,
    `alter table "Assessment" add column if not exists "confidentialityScore" integer;`,
    `alter table "Assessment" add column if not exists "integrityScore" integer;`,
    `alter table "Assessment" add column if not exists "availabilityScore" integer;`
  ];

  for (const sql of statements) {
    await prisma.$executeRawUnsafe(sql);
  }

  const rows = await prisma.$queryRawUnsafe(`
    select column_name
    from information_schema.columns
    where table_name = 'Assessment'
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
