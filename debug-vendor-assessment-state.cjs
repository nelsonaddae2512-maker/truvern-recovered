const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const vendorId = 44;

  console.log("Assessment rows:");
  console.dir(await prisma.$queryRawUnsafe(`
    select
      id,
      status::text as status,
      token,
      "vendorEmail",
      "submittedAt",
      "isVendorSubmitted",
      "updatedAt"
    from "Assessment"
    where "vendorId" = ${vendorId}
    order by id desc
  `), { depth: null });

  console.log("AssessmentRun rows:");
  console.dir(await prisma.$queryRawUnsafe(`
    select id, status::text as status, "updatedAt"
    from "AssessmentRun"
    where "vendorId" = ${vendorId}
    order by id desc
  `), { depth: null });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
