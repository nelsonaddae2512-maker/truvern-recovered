const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

(async () => {
  const row = await prisma.issue.findFirst({});
  console.log(Object.keys(row || {}));
  await prisma.$disconnect();
})().catch(e => {
  console.error(e);
  process.exit(1);
});
