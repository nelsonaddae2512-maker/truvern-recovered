const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const dupes = await prisma.$queryRawUnsafe(`
    select "vendorId", lower(email) as email, array_agg(id order by id asc) as ids
    from "VendorContact"
    where email is not null and trim(email) <> ''
    group by "vendorId", lower(email)
    having count(*) > 1
  `);

  for (const dupe of dupes) {
    const ids = dupe.ids;
    const keep = ids[0];
    const remove = ids.slice(1);

    if (remove.length) {
      await prisma.$executeRawUnsafe(`
        delete from "VendorContact"
        where id in (${remove.map(Number).join(",")})
      `);
    }

    await prisma.$executeRawUnsafe(`
      update "VendorContact"
      set
        email = ${"'" + String(dupe.email).replaceAll("'", "''") + "'"},
        "isPrimary" = coalesce("isPrimary", false),
        "updatedAt" = current_timestamp
      where id = ${Number(keep)}
    `);
  }

  await prisma.$executeRawUnsafe(`
    create unique index if not exists "VendorContact_vendorId_email_key"
    on "VendorContact"("vendorId", "email")
  `);

  console.log(`Cleaned ${dupes.length} duplicate contact groups and created unique index.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
