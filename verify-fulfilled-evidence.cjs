const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.$queryRawUnsafe(`
    select
      id,
      status::text as status,
      "fulfilledEvidenceId",
      "fulfilledAt",
      title
    from "EvidenceRequest"
    where "vendorId" = 37
    order by id desc
    limit 20
  `);

  console.dir(rows, { depth: null });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
