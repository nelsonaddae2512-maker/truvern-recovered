const { PrismaClient } = require("@prisma/client");

async function main() {
  const p = new PrismaClient();

  const candidates = ["vendorRiskSnapshot", "vendorRiskSnapshots", "riskSnapshot", "riskSnapshots"];

  for (const name of candidates) {
    if (p[name]) {
      console.log("Found model:", name);

      const row = await p[name].findFirst({
        orderBy: { id: "desc" },
        select: { id: true },
      });

      if (!row) {
        console.log("No rows for", name);
        continue;
      }

      const full = await p[name].findUnique({ where: { id: row.id } });
      console.log(name, "keys:");
      console.log(Object.keys(full));
      break;
    }
  }

  await p.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
