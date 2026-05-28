const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  try {
    const template = await prisma.$queryRawUnsafe(`
      select
        id,
        name,
        "accessTier"::text as "accessTier",
        source::text as source,
        origin::text as origin,
        "isSystem",
        "isActive"
      from "AssessmentTemplate"
      order by id asc
      limit 5
    `);

    console.log("TEMPLATES:");
    console.dir(template, { depth: null });

    const statuses = await prisma.$queryRawUnsafe(`
      select
        enumlabel
      from pg_enum e
      join pg_type t on t.oid = e.enumtypid
      where t.typname = 'AssessmentStatus'
    `);

    console.log("\nASSESSMENT STATUS ENUM:");
    console.dir(statuses, { depth: null });

    const runColumns = await prisma.$queryRawUnsafe(`
      select
        column_name,
        data_type
      from information_schema.columns
      where table_name = 'AssessmentRun'
      order by ordinal_position
    `);

    console.log("\nASSESSMENT RUN COLUMNS:");
    console.dir(runColumns, { depth: null });
  } catch (error) {
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
