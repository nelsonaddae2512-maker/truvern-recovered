const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const sections = await prisma.assessmentSection.findMany({
    where: { templateId: 71 },
    select: {
      id: true,
      title: true,
      description: true,
      order: true,
      weight: true,
      questions: {
        select: {
          id: true,
          text: true,
          type: true,
          description: true,
          helpText: true,
          weight: true,
          orderIndex: true,
          required: true,
          category: true,
        },
        orderBy: { orderIndex: "asc" },
        take: 3,
      },
    },
    orderBy: { order: "asc" },
    take: 3,
  });

  console.dir(sections, { depth: null });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
