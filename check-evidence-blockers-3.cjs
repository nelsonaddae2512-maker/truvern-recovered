const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.$queryRawUnsafe(`
    select id, title, status::text as status, "vendorId", "updatedAt"
    from "EvidenceRequest"
    where "vendorId" = (
      select "vendorId"
      from "ReviewAssignment"
      where id = 3
      limit 1
    )
    order by id desc
  `);

  console.dir(rows, { depth: null });
}

main().finally(() => prisma.$disconnect());
