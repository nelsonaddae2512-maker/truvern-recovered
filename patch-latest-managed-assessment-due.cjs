const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const assessment = await prisma.truvernFrameworkAssessment.findFirst({
    where: {
      reviewAssignmentId: 67,
    },
    orderBy: {
      updatedAt: "desc",
    },
    select: {
      id: true,
      metadata: true,
    },
  });

  if (!assessment) {
    throw new Error("No managed assessment found for assignment 67.");
  }

  const dueAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

  await prisma.truvernFrameworkAssessment.update({
    where: { id: assessment.id },
    data: {
      metadata: {
        ...(assessment.metadata || {}),
        managedReviewDueAt: dueAt,
        managedReviewDueDays: 14,
      },
    },
  });

  console.log({
    assessmentId: assessment.id,
    managedReviewDueAt: dueAt,
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
