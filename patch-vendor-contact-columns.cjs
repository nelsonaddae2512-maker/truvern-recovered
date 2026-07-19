const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe(`
    alter table "VendorContact"
    add column if not exists "role" text default 'OTHER';
  `);

  await prisma.$executeRawUnsafe(`
    alter table "VendorContact"
    add column if not exists "phone" text;
  `);

  await prisma.$executeRawUnsafe(`
    alter table "VendorContact"
    add column if not exists "isPrimary" boolean not null default false;
  `);

  await prisma.$executeRawUnsafe(`
    alter table "VendorContact"
    add column if not exists "createdAt" timestamp(3) not null default current_timestamp;
  `);

  await prisma.$executeRawUnsafe(`
    alter table "VendorContact"
    add column if not exists "updatedAt" timestamp(3) not null default current_timestamp;
  `);

  const rows = await prisma.$queryRawUnsafe(`
    select column_name
    from information_schema.columns
    where table_name = 'VendorContact'
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
