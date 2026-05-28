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
    frameworkId: framework?.id,
    slug: framework?.slug,
    name: framework?.name,
    controls: framework?.controls.length,
    questions: framework?.controls.reduce((sum, c) => sum + c.questions.length, 0),
  });

  const latest = await prisma.truvernFrameworkAssessment.findFirst({
    where: { reviewAssignmentId: 67 },
    orderBy: { updatedAt: "desc" },
    include: {
      responses: {
        include: {
          question: {
            include: {
              control: true,
            },
          },
        },
      },
    },
  });

  console.log({
    latestAssessmentId: latest?.id,
    title: latest?.title,
    responseCount: latest?.responses.length,
    firstFive: latest?.responses.slice(0, 5).map((r) => ({
      control: r.question.control.controlId,
      prompt: r.question.prompt,
    })),
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
