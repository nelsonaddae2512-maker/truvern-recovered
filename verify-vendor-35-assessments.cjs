const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.$queryRawUnsafe(`
    select
      id,
      "vendorId",
      "assessmentId",
      status::text as status,
      "startedAt",
      "createdAt",
      "updatedAt"
    from "AssessmentRun"
    where "vendorId" = 35
    order by "createdAt" desc, id desc
  `);

  console.dir(rows, { depth: null });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
