const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const enumRows = await prisma.$queryRawUnsafe(`
    select enumlabel
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'NotificationType'
    order by e.enumsortorder
  `);

  const rowTypes = await prisma.$queryRawUnsafe(`
    select "type"::text as type, count(*)::int as count
    from "Notification"
    group by "type"::text
    order by "type"::text
  `);

  console.log("DB enum values:");
  console.dir(enumRows, { depth: null });

  console.log("Notification row types:");
  console.dir(rowTypes, { depth: null });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
