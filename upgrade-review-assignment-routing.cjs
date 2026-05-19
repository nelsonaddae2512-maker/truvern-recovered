const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe(`
    alter table "ReviewAssignment"
      add column if not exists "vendorId" integer,
      add column if not exists "assignmentType" text;
  `);

  await prisma.$executeRawUnsafe(`
    create index if not exists "ReviewAssignment_vendorId_idx"
    on "ReviewAssignment" ("vendorId");
  `);

  await prisma.$executeRawUnsafe(`
    create index if not exists "ReviewAssignment_assignmentType_idx"
    on "ReviewAssignment" ("assignmentType");
  `);

  console.log("ReviewAssignment vendor/routing columns upgraded.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
