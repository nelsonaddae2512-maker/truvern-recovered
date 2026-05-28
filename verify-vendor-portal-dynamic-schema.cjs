const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const tables = [
    "Assessment",
    "AssessmentRun",
    "ReviewRequest",
    "ReviewAssignment",
    "ReviewResponse",
    "EvidenceRequest",
    "Evidence",
  ];

  for (const table of tables) {
    const rows = await prisma.$queryRawUnsafe(`
      select column_name, data_type, udt_name
      from information_schema.columns
      where table_name = '${table}'
      order by ordinal_position
    `);

    console.log("\n== " + table + " ==");
    console.table(rows);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
