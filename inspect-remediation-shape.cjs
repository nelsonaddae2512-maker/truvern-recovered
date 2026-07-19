const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.$queryRawUnsafe(`
    select
      id,
      responses
    from "ReviewResponse"
    where "reviewAssignmentId" = 76
    order by "updatedAt" desc
    limit 1
  `);

  const response = rows?.[0]?.responses ?? {};

  console.log("=== TRUVERN REMEDIATION ===");
  console.dir(response.truvernRemediation, { depth: null });

  console.log("");
  console.log("=== FIRST PLAN ===");

  if (
    response.truvernRemediation &&
    Array.isArray(response.truvernRemediation.plans) &&
    response.truvernRemediation.plans.length > 0
  ) {
    console.dir(response.truvernRemediation.plans[0], { depth: null });
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
