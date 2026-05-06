const { PrismaClient } = require("@prisma/client");

async function main() {
  const p = new PrismaClient();

  const row = await p.vendorRiskSnapshot.findFirst({
    orderBy: { id: "desc" },
    select: { id: true },
  });

  if (!row) {
    console.log("No vendorRiskSnapshot rows found.");
    await p.$disconnect();
    return;
  }

  const full = await p.vendorRiskSnapshot.findUnique({
    where: { id: row.id },
  });

  console.log("vendorRiskSnapshot keys:");
  console.log(Object.keys(full));

  await p.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
