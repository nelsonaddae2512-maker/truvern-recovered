const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {

  const columns = await prisma.$queryRawUnsafe(`
    select
      column_name,
      data_type,
      is_nullable,
      column_default
    from information_schema.columns
    where table_name = 'AssessmentTemplate'
    order by ordinal_position
  `);

  console.log("\n=== AssessmentTemplate columns ===\n");
  console.dir(columns, { depth: null });

  const sample = await prisma.$queryRawUnsafe(`
    select
      id,
      "organizationId",
      name,
      code,
      origin::text as origin,
      source::text as source,
      "accessTier"::text as "accessTier"
    from "AssessmentTemplate"
    order by id desc
    limit 10
  `);

  console.log("\n=== Existing template rows ===\n");
  console.dir(sample, { depth: null });

  const orgs = await prisma.$queryRawUnsafe(`
    select id, name, slug
    from "Organization"
    order by id asc
    limit 10
  `);

  console.log("\n=== Organizations ===\n");
  console.dir(orgs, { depth: null });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
