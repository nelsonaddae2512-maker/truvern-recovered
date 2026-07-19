const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const vendorId = 44;

  console.log("AssessmentRun rows:");
  console.dir(await prisma.$queryRawUnsafe(`
    select id, status::text, "updatedAt"
    from "AssessmentRun"
    where "vendorId" = ${vendorId}
    order by id desc
  `), { depth: null });

  console.log("ReviewAssignment rows:");
  console.dir(await prisma.$queryRawUnsafe(`
    select
      ra.id,
      ra.status::text,
      ra."assignmentType"::text,
      ra."reviewRequestId",
      ra."vendorId",
      coalesce(rr."vendorId", ra."vendorId") as "resolvedVendorId",
      coalesce(resp.responses->>'releaseState', '') as "releaseState",
      ra."updatedAt"
    from "ReviewAssignment" ra
    left join "ReviewRequest" rr on rr.id = ra."reviewRequestId"
    left join lateral (
      select r.responses
      from "ReviewResponse" r
      where r."reviewAssignmentId" = ra.id
      order by r."updatedAt" desc, r.id desc
      limit 1
    ) resp on true
    where coalesce(rr."vendorId", ra."vendorId") = ${vendorId}
    order by ra.id desc
  `), { depth: null });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
