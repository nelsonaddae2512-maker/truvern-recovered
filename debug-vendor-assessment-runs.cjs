const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const vendorId = 44;

  const rows = await prisma.assessmentRun.findMany({
    where: {
      vendorId,
    },
    orderBy: {
      id: "desc",
    },
    select: {
      id: true,
      status: true,
      token: true,
      submittedAt: true,
      isVendorSubmitted: true,
      updatedAt: true,
    },
  });

  console.dir(rows, { depth: null });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
