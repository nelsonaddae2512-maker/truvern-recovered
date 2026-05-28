const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const vendorId = 44;

  console.log("AssessmentRun counts:");
  console.dir(await prisma.$queryRawUnsafe(`
    select status::text, count(*)::int
    from "AssessmentRun"
    where "vendorId" = ${vendorId}
    group by status::text
    order by status::text
  `), { depth: null });

  console.log("ReviewAssignment counts:");
  console.dir(await prisma.$queryRawUnsafe(`
    select
      ra.status::text as status,
      coalesce(resp.responses->>'releaseState', '') as "releaseState",
      count(*)::int
    from "ReviewAssignment" ra
    left join "ReviewRequest" req on req.id = ra."reviewRequestId"
    left join lateral (
      select r.responses
      from "ReviewResponse" r
      where r."reviewAssignmentId" = ra.id
      order by r."updatedAt" desc, r.id desc
      limit 1
    ) resp on true
    where coalesce(req."vendorId", ra."vendorId") = ${vendorId}
    group by ra.status::text, coalesce(resp.responses->>'releaseState', '')
    order by ra.status::text, coalesce(resp.responses->>'releaseState', '')
  `), { depth: null });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
