const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

(async () => {
  const orgId = 2;
  const vendorId = 1;

  const rows = await prisma.evidenceRequest.findMany({
    where: { organizationId: orgId, vendorId },
    select: { id: true, status: true, createdAt: true, dueAt: true, kind: true, title: true, updatedAt: true },
    orderBy: { id: "asc" },
  });

  console.log("Total evidenceRequest rows:", rows.length);

  const byStatus = new Map();
  for (const r of rows) {
    const s = String(r.status ?? "").trim() || "(empty)";
    byStatus.set(s, (byStatus.get(s) || 0) + 1);
  }

  console.log("Status counts:");
  console.log(Object.fromEntries([...byStatus.entries()].sort((a, b) => b[1] - a[1])));

  console.log("Sample rows (first 10):");
  console.log(rows.slice(0, 10));
})()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
