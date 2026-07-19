const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.$queryRawUnsafe(`
    select id, name, "organizationId"
    from "Vendor"
    order by id desc
    limit 1
  `);

  const vendor = rows?.[0];

  if (!vendor) {
    console.log("No vendor found.");
    return;
  }

  await prisma.$executeRawUnsafe(`
    update "Vendor"
    set
      "reviewCadenceDays" = 365,
      "nextReviewDueAt" = now() + interval '7 days'
    where id = $1
  `, vendor.id);

  console.log({
    vendorId: vendor.id,
    vendorName: vendor.name,
    organizationId: vendor.organizationId,
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
