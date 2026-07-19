const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

console.log(
  Object.keys(prisma)
    .filter((key) => key.toLowerCase().includes("truvern"))
    .sort()
);

prisma.$disconnect();
