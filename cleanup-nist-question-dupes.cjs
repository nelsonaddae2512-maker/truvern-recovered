const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const deleted = await prisma.$executeRawUnsafe(`
    delete from "TruvernControlQuestion" tq
    using "TruvernControlQuestion" keep
    where tq."controlId" = keep."controlId"
      and tq.prompt = keep.prompt
      and tq.id > keep.id
  `);

  console.log({ deleted });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
