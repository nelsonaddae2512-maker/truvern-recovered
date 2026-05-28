const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.$queryRawUnsafe(`
    select
      id,
      name,
      description,
      standard,
      category,
      version,
      "accessTier"::text as "accessTier",
      source::text as source,
      origin::text as origin,
      "isSystem",
      "isActive",
      "createdAt",
      "updatedAt"
    from "AssessmentTemplate"
    where
      name ilike '%nist%'
      or standard ilike '%nist%'
      or description ilike '%800-53%'
    order by id desc
  `);

  console.dir(rows, { depth: null });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
