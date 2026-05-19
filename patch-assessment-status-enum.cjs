const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const values = [
    "LAUNCHED",
    "SUBMITTED",
    "REVIEW_READY",
    "UNDER_REVIEW",
    "RELEASED"
  ];

  for (const value of values) {
    await prisma.$executeRawUnsafe(`
      do $$
      begin
        if not exists (
          select 1
          from pg_enum e
          join pg_type t on t.oid = e.enumtypid
          where t.typname = 'AssessmentStatus'
            and e.enumlabel = '${value}'
        ) then
          alter type "AssessmentStatus" add value '${value}';
        end if;
      end $$;
    `);
  }

  const rows = await prisma.$queryRawUnsafe(`
    select e.enumlabel
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'AssessmentStatus'
    order by e.enumsortorder
  `);

  console.table(rows);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
