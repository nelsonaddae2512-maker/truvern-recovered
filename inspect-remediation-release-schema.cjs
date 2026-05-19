const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const tables = await prisma.$queryRawUnsafe(`
    select
      table_name
    from information_schema.tables
    where table_schema = 'public'
      and (
        lower(table_name) like '%snapshot%'
        or lower(table_name) like '%release%'
        or lower(table_name) like '%governance%'
        or lower(table_name) like '%seal%'
        or lower(table_name) like '%review%'
      )
    order by table_name;
  `);

  console.log("\\n=== TABLES ===");
  console.dir(tables, { depth: null });

  const remediation = await prisma.$queryRawUnsafe(`
    select
      table_name,
      column_name,
      data_type,
      udt_name
    from information_schema.columns
    where table_schema = 'public'
      and (
        lower(table_name) like '%evidence%'
        or lower(table_name) like '%remediation%'
      )
    order by table_name, ordinal_position;
  `);

  console.log("\\n=== REMEDIATION TABLES ===");
  console.dir(remediation, { depth: null });
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
