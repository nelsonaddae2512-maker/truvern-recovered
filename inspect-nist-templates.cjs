const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const templates = await prisma.assessmentTemplate.findMany({
    where: {
      name: {
        contains: "NIST",
        mode: "insensitive",
      },
    },
    select: {
      id: true,
      name: true,
      standard: true,
      version: true,
      _count: {
        select: {
          questions: true,
          sections: true,
        },
      },
    },
    orderBy: { id: "asc" },
  });

  console.dir(templates, { depth: null });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
