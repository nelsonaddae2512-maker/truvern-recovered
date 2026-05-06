const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();

(async () => {
  const r = await p.vendorRiskSnapshot.findMany({
    take: 5,
    orderBy: { sealedAt: "desc" },
    select: { vendorId: true, sealedAt: true, score: true },
  });
  console.log(r);
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
}).finally(async () => {
  await p.$disconnect();
});
