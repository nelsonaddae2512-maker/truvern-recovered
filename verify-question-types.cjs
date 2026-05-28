const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.$queryRawUnsafe(`
    select
      enumlabel
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'QuestionType'
    order by enumlabel asc
  `);

  console.dir(rows, { depth: null });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
