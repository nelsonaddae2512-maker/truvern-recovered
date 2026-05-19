const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.$queryRawUnsafe(`
    select
      v.id as "vendorId",
      v.name as "vendorName",
      v.slug,
      count(rr.id)::int as "responseCount"
    from "Vendor" v
    join "ReviewAssignment" ra on ra."vendorId" = v.id
    join "ReviewResponse" rr on rr."reviewAssignmentId" = ra.id
    group by v.id, v.name, v.slug
    order by "responseCount" desc, v.id desc
    limit 20
  `);

  console.dir(rows, { depth: null });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
