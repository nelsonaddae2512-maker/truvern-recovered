const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const request = await prisma.$queryRawUnsafe(`
    select *
    from "ReviewRequest"
    where id = 73
    limit 1
  `);

  console.log("REVIEW REQUEST");
  console.dir(request, { depth: null });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
