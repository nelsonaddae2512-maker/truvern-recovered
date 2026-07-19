const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const before = await prisma.$queryRawUnsafe(`
    select id, status
    from "RemediationPackage"
    order by id asc
    limit 1
  `);

  console.log("Before:");
  console.table(before);

  const pkg = before[0];
  if (!pkg) return;

  await prisma.$executeRawUnsafe(`
    insert into "WorkflowEvent" (
      "workflowId",
      "organizationId",
      "vendorId",
      "reviewAssignmentId",
      type,
      actor,
      summary,
      payload,
      "createdAt"
    )
    select
      wi.id,
      rp."organizationId",
      rp."vendorId",
      rp."reviewAssignmentId",
      'SMOKE_TEST_EVENT',
      'SYSTEM',
      'Workflow infrastructure smoke test.',
      jsonb_build_object('packageId', rp.id),
      now()
    from "RemediationPackage" rp
    left join "WorkflowInstance" wi
      on wi."reviewAssignmentId" = rp."reviewAssignmentId"
     and wi."vendorId" = rp."vendorId"
    where rp.id = $1
    limit 1
  `, pkg.id);

  const counts = await prisma.$queryRawUnsafe(`
    select type, count(*)::int as count
    from "WorkflowEvent"
    group by type
    order by type
  `);

  console.log("Workflow events:");
  console.table(counts);
}

main().catch(console.error).finally(() => prisma.$disconnect());
