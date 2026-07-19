const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.notification.findMany({
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true,
      userId: true,
      organizationId: true,
      type: true,
      severity: true,
      title: true,
      href: true,
      readAt: true,
      createdAt: true,
      metadataJson: true,
    },
  });

  console.dir(rows, { depth: null });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
