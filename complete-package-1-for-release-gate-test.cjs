const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe(`
    update "WorkflowTask"
    set
      status = 'COMPLETED',
      result = coalesce(result, 'TEST_COMPLETED'),
      notes = coalesce(notes, 'Completed for release gate smoke test.'),
      "completedAt" = coalesce("completedAt", now()),
      "updatedAt" = now()
    where "packageId" = 1
      and status <> 'COMPLETED'
  `);

  await prisma.$executeRawUnsafe(`
    update "RemediationPackage"
    set status = 'APPROVED', "updatedAt" = now()
    where id = 1
  `);

  await prisma.$executeRawUnsafe(`
    update "WorkflowQueueItem"
    set queue = 'READY_FOR_RELEASE_CHECK', "updatedAt" = now()
    where payload->>'remediationPackageId' = '1'
  `);

  console.log("Package 1 moved to approved/release-check test state.");
}

main().catch(console.error).finally(() => prisma.$disconnect());
