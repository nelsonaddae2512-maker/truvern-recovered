const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();

(async () => {
  const latest = await p.vendorRiskSnapshot.findFirst({
    where: { vendorId: 1, sealedAt: { not: null } },
    orderBy: { sealedAt: "desc" },
  });

  if (!latest) throw new Error("No sealed snapshot found for vendorId=1");

  const created = await p.vendorRiskSnapshot.create({
    data: {
      organizationId: latest.organizationId,
      vendorId: latest.vendorId,
      score: (latest.score ?? 72) + 4,
      label: latest.label,
      summary: latest.summary,
      details: latest.details,
      sealedAt: new Date(),
      sealedHash: (latest.sealedHash || "test") + "_test2",
    },
    select: { id: true, vendorId: true, sealedAt: true, score: true },
  });

  console.log("Created:", created);

  const lastTwo = await p.vendorRiskSnapshot.findMany({
    where: { vendorId: 1, sealedAt: { not: null } },
    orderBy: { sealedAt: "desc" },
    take: 2,
    select: { id: true, sealedAt: true, score: true },
  });

  console.log("Last two:", lastTwo);
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
}).finally(async () => {
  await p.$disconnect();
});
