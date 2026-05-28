const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.$queryRawUnsafe(`
    select
      ra.id,
      ra.status::text as status,
      ra."reviewRequestId",
      ra."vendorId" as "assignmentVendorId",
      rr.id as "requestId",
      rr."vendorId" as "requestVendorId",
      coalesce(rr."vendorId", ra."vendorId") as "resolvedVendorId",
      v.name as "vendorName"
    from "ReviewAssignment" ra
    left join "ReviewRequest" rr on rr.id = ra."reviewRequestId"
    left join "Vendor" v on v.id = coalesce(rr."vendorId", ra."vendorId")
    where ra.id = 178
  `);

  console.dir(rows, { depth: null });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
