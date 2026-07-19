const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe(`
    update "AssessmentTemplate"
    set
      "accessTier" = 'PRO',
      "isSystem" = true,
      "isFeatured" = true,
      origin = 'TRUVERN',
      "catalogKey" = 'truvern-nist-800-53-governance-review',
      "updatedAt" = now()
    where name = 'Truvern NIST 800-53 Governance Review'
  `);

  const rows = await prisma.$queryRawUnsafe(`
    select id, name, "accessTier"::text as "accessTier", "isActive", "isSystem", origin
    from "AssessmentTemplate"
    where name = 'Truvern NIST 800-53 Governance Review'
  `);

  console.dir(rows, { depth: null });
}

main().catch(console.error).finally(() => prisma.$disconnect());
