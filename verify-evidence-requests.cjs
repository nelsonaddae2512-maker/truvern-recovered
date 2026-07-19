const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.$queryRawUnsafe(`
    select
      id,
      "vendorId",
      "organizationId",
      kind::text as kind,
      status::text as status,
      title,
      notes,
      "reviewNote",
      "dueAt",
      "createdAt"
    from "EvidenceRequest"
    order by id desc
    limit 10
  `);

  console.dir(rows, { depth: null });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
