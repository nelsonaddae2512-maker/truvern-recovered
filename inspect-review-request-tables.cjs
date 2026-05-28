const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const tables = await prisma.$queryRawUnsafe(`
    select table_name
    from information_schema.tables
    where table_schema = 'public'
      and (
        table_name ilike '%Review%Request%'
        or table_name ilike '%Assessment%Request%'
        or table_name ilike '%Request%'
      )
    order by table_name
  `);

  console.log("TABLES");
  console.dir(tables, { depth: null });

  const assignment = await prisma.$queryRawUnsafe(`
    select *
    from "ReviewAssignment"
    where id = 67
    limit 1
  `);

  console.log("ASSIGNMENT");
  console.dir(assignment, { depth: null });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
