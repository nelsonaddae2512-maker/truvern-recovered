const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

function sqlString(value) {
  if (value === null || value === undefined) return "null";
  return `'${String(value).replaceAll("'", "''")}'`;
}

async function main() {
  const vendors = await prisma.$queryRawUnsafe(`
    select id, "organizationId", "contactName", lower("contactEmail") as email
    from "Vendor"
    where "contactEmail" is not null
      and trim("contactEmail") <> ''
  `);

  let count = 0;

  for (const vendor of vendors) {
    const name = vendor.contactName || "Primary vendor contact";
    const email = vendor.email;

    await prisma.$executeRawUnsafe(`
      insert into "VendorContact" (
        "organizationId",
        "vendorId",
        "name",
        "email",
        "role",
        "isPrimary",
        "createdAt",
        "updatedAt"
      )
      values (
        ${Number(vendor.organizationId)},
        ${Number(vendor.id)},
        ${sqlString(name)},
        ${sqlString(email)},
        'PRIMARY',
        true,
        current_timestamp,
        current_timestamp
      )
      on conflict ("vendorId", "email")
      do update set
        "organizationId" = excluded."organizationId",
        "name" = excluded."name",
        "role" = 'PRIMARY',
        "isPrimary" = true,
        "updatedAt" = current_timestamp
    `);

    count++;
  }

  console.log(`Backfilled ${count} vendor contacts.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
