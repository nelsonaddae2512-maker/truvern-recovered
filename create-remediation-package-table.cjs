const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe(`
    create table if not exists "RemediationPackage" (
      id serial primary key,
      "reviewAssignmentId" integer not null,
      "vendorId" integer not null,
      "organizationId" integer not null,
      "evidenceRequestId" integer null,
      "sourceKey" text not null,
      title text not null,
      status text not null default 'REQUESTED',
      severity text null,
      "dueAt" timestamp without time zone null,
      payload jsonb not null default '{}'::jsonb,
      "createdAt" timestamp without time zone not null default now(),
      "updatedAt" timestamp without time zone not null default now()
    )
  `);

  await prisma.$executeRawUnsafe(`
    create unique index if not exists "RemediationPackage_assignment_source_unique"
    on "RemediationPackage" ("reviewAssignmentId", "sourceKey")
  `);

  await prisma.$executeRawUnsafe(`
    create index if not exists "RemediationPackage_vendor_status_idx"
    on "RemediationPackage" ("vendorId", status)
  `);

  console.log("RemediationPackage table ready.");
}

main().catch(console.error).finally(() => prisma.$disconnect());
