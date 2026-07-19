const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const assessment = await prisma.truvernFrameworkAssessment.findUnique({
    where: { id: 10 },
    select: { id: true, vendorId: true, metadata: true },
  });

  const vendor = assessment?.vendorId
    ? await prisma.vendor.findUnique({
        where: { id: assessment.vendorId },
        select: { name: true },
      })
    : null;

  await prisma.truvernFrameworkAssessment.update({
    where: { id: 10 },
    data: {
      title: `Truvern Vendor Risk Assessment for ${vendor?.name || "this vendor"}`,
      metadata: {
        ...(assessment?.metadata || {}),
        requestedBy: "Nelson Addae",
        requestedByEmail: null,
      },
    },
  });

  console.log("Updated assessment 10 requester metadata.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
