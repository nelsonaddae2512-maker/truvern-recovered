const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const sample = await prisma.truvernControlQuestion.findFirst();
  console.dir(sample, { depth: null });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
