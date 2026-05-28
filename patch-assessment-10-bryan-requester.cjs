const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.truvernFrameworkAssessment.findUnique({
    where: { id: 10 },
    select: { metadata: true },
  });

  await prisma.truvernFrameworkAssessment.update({
    where: { id: 10 },
    data: {
      metadata: {
        ...(existing?.metadata || {}),
        requestedBy: "Bryan Addae",
        requestedByEmail: null,
      },
    },
  });

  console.log("Updated requester to Bryan Addae.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
