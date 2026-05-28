const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const tables = await prisma.$queryRawUnsafe(`
    select table_name
    from information_schema.tables
    where table_schema = 'public'
      and table_name in ('Organization', 'Subscription', 'Plan')
    order by table_name
  `);

  console.log("\n=== tables ===");
  console.dir(tables, { depth: null });

  for (const table of ['Organization', 'Subscription', 'Plan']) {
    const cols = await prisma.$queryRawUnsafe(`
      select column_name, data_type, is_nullable, column_default
      from information_schema.columns
      where table_name = '${table}'
      order by ordinal_position
    `);

    console.log(`\n=== ${table} columns ===`);
    console.dir(cols, { depth: null });
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
