const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const assessments = await prisma.truvernFrameworkAssessment.findMany({
    where: { reviewAssignmentId: 67 },
    select: {
      id: true,
      vendorId: true,
    },
  });

  for (const assessment of assessments) {
    const vendor = assessment.vendorId
      ? await prisma.vendor.findUnique({
          where: { id: assessment.vendorId },
          select: { name: true },
        })
      : null;

    await prisma.truvernFrameworkAssessment.update({
      where: { id: assessment.id },
      data: {
        title: `Truvern Vendor Risk Assessment requested for ${vendor?.name || "this vendor"}`,
      },
    });
  }

  console.log({ updated: assessments.length });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
