const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const vendorId = 44;

  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    select: {
      id: true,
      assessments: {
        where: {
          status: {
            notIn: ["ARCHIVED"],
          },
        },
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        select: {
          id: true,
          status: true,
          updatedAt: true,
        },
      },
    },
  });

  console.dir(vendor, { depth: null });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
