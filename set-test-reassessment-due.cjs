const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const vendor = await prisma.vendor.findFirst({
    orderBy: { id: "desc" },
    select: { id: true, name: true, organizationId: true }
  });

  if (!vendor) {
    console.log("No vendor found.");
    return;
  }

  const due = new Date();
  due.setUTCDate(due.getUTCDate() + 7);

  await prisma.vendor.update({
    where: { id: vendor.id },
    data: {
      reviewCadenceDays: 365,
      nextReviewDueAt: due
    }
  });

  console.log({
    updatedVendorId: vendor.id,
    vendorName: vendor.name,
    organizationId: vendor.organizationId,
    nextReviewDueAt: due
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
