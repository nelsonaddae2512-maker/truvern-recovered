const { PrismaClient } = require("@prisma/client");

async function main() {
  const p = new PrismaClient();

  const vendors = await p.vendor.findMany({
    take: 10,
    orderBy: { id: "desc" },
    select: {
      id: true,
      name: true,
      slug: true,
      vendorRiskSnapshots: {
        take: 1,
        orderBy: { createdAt: "desc" },
        select: { id: true, sealedAt: true, sealedHash: true, score: true },
      },
    },
  });

  const rows = vendors.map((x) => {
    const s = x.vendorRiskSnapshots?.[0] || null;
    const verified = Boolean(s?.sealedAt && s?.sealedHash);
    return {
      id: x.id,
      name: x.name,
      slug: x.slug,
      snapshotId: s?.id ?? null,
      verified,
      sealedAt: s?.sealedAt ?? null,
      score: typeof s?.score === "number" ? Math.round(s.score) : null,
    };
  });

  console.table(rows);

  await p.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
