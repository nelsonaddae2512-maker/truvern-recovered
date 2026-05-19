const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const cols = await prisma.$queryRawUnsafe(`
    select column_name, data_type, udt_name, is_nullable
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'GovernanceReleaseManifest'
    order by ordinal_position;
  `);

  console.log("GovernanceReleaseManifest columns:");
  console.dir(cols, { depth: null });

  const sample = await prisma.$queryRawUnsafe(`
    select *
    from "GovernanceReleaseManifest"
    order by id desc
    limit 1;
  `);

  console.log("Latest manifest sample:");
  console.dir(sample, { depth: null });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
