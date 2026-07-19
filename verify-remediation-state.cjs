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

  const response = rows[0];

  const plans =
    response?.responses?.truvernRemediation?.plans ?? [];

  console.dir(
    plans.map((p) => ({
      title: p.title,
      status: p.status,
      evidenceStatus: p.evidenceStatus,
      attestationStatus: p.attestationStatus,
      blockerStatus: p.blockerStatus,
    })),
    { depth: null }
  );
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
