const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe(`
    update "Organization"
    set "planTier" = 'PRO'::"OrganizationPlanTier",
        "updatedAt" = now()
    where id = 42
  `);

  const rows = await prisma.$queryRawUnsafe(`
    select id, name, "clerkOrgId", "planTier"::text as "planTier", "updatedAt"
    from "Organization"
    where id in (37, 42)
    order by id
  `);

  console.dir(rows, { depth: null });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
