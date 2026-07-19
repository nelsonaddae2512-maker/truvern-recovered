const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

function cleanText(value) {
  if (!value || typeof value !== "string") return value;

  return value
    .replaceAll("Â·", "·")
    .replaceAll("â†’", "->")
    .replaceAll("â€”", "-")
    .replaceAll("â€œ", '"')
    .replaceAll("â€", '"')
    .replaceAll("â€™", "'");
}

async function main() {
  const rows = await prisma.notification.findMany({
    select: {
      id: true,
      title: true,
      message: true,
    },
  });

  let updated = 0;

  for (const row of rows) {
    const title = cleanText(row.title);
    const message = cleanText(row.message);

    if (title !== row.title || message !== row.message) {
      await prisma.notification.update({
        where: { id: row.id },
        data: { title, message },
      });

      updated++;
    }
  }

  console.log(`Cleaned ${updated} notification rows.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
