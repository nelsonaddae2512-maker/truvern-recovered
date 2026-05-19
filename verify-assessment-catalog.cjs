const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.$queryRawUnsafe(`
    select
      id,
      name,
      "catalogKey",
      origin::text as origin,
      source::text as source,
      "accessTier"::text as "accessTier",
      "isSystem",
      "isFeatured"
    from "AssessmentTemplate"
    where origin = 'CATALOG'::"TemplateOrigin"
    order by "accessTier", name
  `);

  console.dir(rows, { depth: null });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
