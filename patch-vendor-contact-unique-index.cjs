const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe(`
    create unique index if not exists "VendorContact_vendorId_email_key"
    on "VendorContact"("vendorId", "email")
  `);

  console.log("VendorContact unique index ready.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
