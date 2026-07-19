const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const framework = await prisma.truvernFramework.findUnique({
    where: { slug: "nist-800-53-rev5" },
    include: {
      controls: {
        include: {
          questions: true,
        },
      },
    },
  });

  console.log({
    controls: framework?.controls.length,
    questions: framework?.controls.reduce((sum, c) => sum + c.questions.length, 0),
  });

  const latest = await prisma.truvernFrameworkAssessment.findUnique({
    where: { id: 9 },
    include: { responses: true },
  });

  console.log({
    assessmentId: latest?.id,
    responses: latest?.responses.length,
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
