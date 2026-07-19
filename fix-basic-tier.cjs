const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const result = await prisma.$executeRawUnsafe(`
    update "Vendor"
    set tier = 'STANDARD'
    where tier::text = 'BASIC'
  `);

  console.log("Updated:", result);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
