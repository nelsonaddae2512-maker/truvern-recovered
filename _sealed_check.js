const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

(async () => {
  const rows = await prisma.vendorRiskSnapshot.findMany({
    where: { sealedAt: { not: null } },
    select: { id: true, vendorId: true, sealedAt: true, sealedHash: true },
    orderBy: { sealedAt: "desc" }
  });

  console.log(rows);
  await prisma.$disconnect();
})();
