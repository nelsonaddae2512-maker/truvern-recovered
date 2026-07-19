const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const orgs = await prisma.organization.findMany({
    orderBy: { id: "asc" },
    select: { id: true, name: true, clerkOrgId: true }
  });

  const vendors = await prisma.vendor.findMany({
    orderBy: { id: "desc" },
    take: 10,
    select: { id: true, name: true, organizationId: true, createdAt: true }
  });

  console.dir({ orgs, vendors }, { depth: null });
}

main().finally(() => prisma.$disconnect());
