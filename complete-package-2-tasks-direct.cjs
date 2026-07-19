const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const tasks = await prisma.$queryRawUnsafe(`
    select id
    from "WorkflowTask"
    where "packageId" = 2
      and status <> 'COMPLETED'
    order by id asc
  `);

  console.log("Completing tasks:", tasks.map(t => t.id));

  for (const task of tasks) {
    await prisma.$executeRawUnsafe(`
      update "WorkflowTask"
      set status = 'COMPLETED', "completedAt" = now(), "updatedAt" = now()
      where id = $1
    `, task.id);
  }

  const rows = await prisma.$queryRawUnsafe(`
    select
      rp.id,
      rp.status as "packageStatus",
      qi.queue,
      qi.status as "queueStatus"
    from "RemediationPackage" rp
    left join "WorkflowQueueItem" qi
      on qi.payload->>'remediationPackageId' = rp.id::text
    where rp.id = 2
  `);

  console.table(rows);
}

main().catch(console.error).finally(() => prisma.$disconnect());
