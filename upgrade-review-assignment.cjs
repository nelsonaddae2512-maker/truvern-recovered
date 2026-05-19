const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe(`
    alter table "ReviewAssignment"
      add column if not exists "reviewRequestId" integer,
      add column if not exists "reviewerUserId" text,
      add column if not exists "assignedReviewerName" text,
      add column if not exists "reviewerName" text,
      add column if not exists "assignedTo" text,
      add column if not exists "note" text,
      add column if not exists "startedAt" timestamp(3),
      add column if not exists "claimedAt" timestamp(3),
      add column if not exists "submittedAt" timestamp(3),
      add column if not exists "completedAt" timestamp(3);
  `);

  await prisma.$executeRawUnsafe(`
    create index if not exists "ReviewAssignment_reviewRequestId_idx"
    on "ReviewAssignment" ("reviewRequestId");
  `);

  await prisma.$executeRawUnsafe(`
    create index if not exists "ReviewAssignment_reviewerUserId_idx"
    on "ReviewAssignment" ("reviewerUserId");
  `);

  console.log("ReviewAssignment table upgraded.");
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
