const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function addColumn(sql) {
  await prisma.$executeRawUnsafe(sql);
}

async function main() {
  await addColumn(`alter table "Assessment" add column if not exists "token" text unique;`);
  await addColumn(`alter table "Assessment" add column if not exists "vendorEmail" text;`);
  await addColumn(`alter table "Assessment" add column if not exists "vendorContactName" text;`);
  await addColumn(`alter table "Assessment" add column if not exists "launchedAt" timestamp(3);`);
  await addColumn(`alter table "Assessment" add column if not exists "openedAt" timestamp(3);`);
  await addColumn(`alter table "Assessment" add column if not exists "reviewReadyAt" timestamp(3);`);
  await addColumn(`alter table "Assessment" add column if not exists "submissionVersion" integer not null default 1;`);
  await addColumn(`alter table "Assessment" add column if not exists "internalReviewerId" text;`);
  await addColumn(`alter table "Assessment" add column if not exists "truvernReviewerId" text;`);
  await addColumn(`alter table "Assessment" add column if not exists "reviewAssignmentId" integer;`);
  await addColumn(`alter table "Assessment" add column if not exists "completionPercent" integer not null default 0;`);
  await addColumn(`alter table "Assessment" add column if not exists "isVendorSubmitted" boolean not null default false;`);

  const rows = await prisma.$queryRawUnsafe(`
    select column_name
    from information_schema.columns
    where table_name = 'Assessment'
      and column_name in (
        'token',
        'vendorEmail',
        'vendorContactName',
        'launchedAt',
        'openedAt',
        'reviewReadyAt',
        'submissionVersion',
        'internalReviewerId',
        'truvernReviewerId',
        'reviewAssignmentId',
        'completionPercent',
        'isVendorSubmitted'
      )
    order by column_name
  `);

  console.table(rows);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
