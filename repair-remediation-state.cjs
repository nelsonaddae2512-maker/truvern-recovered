const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.$queryRawUnsafe(`
    select id, responses
    from "ReviewResponse"
    where "reviewAssignmentId" = 76
    order by "updatedAt" desc
    limit 1
  `);

  const row = rows[0];

  const responses = row.responses || {};
  const remediation = responses.truvernRemediation || {};

  remediation.plans = (remediation.plans || []).map(plan => {
    if (
      plan.status === "OPEN" &&
      plan.evidenceStatus === "APPROVED" &&
      plan.blockerStatus === "OPEN"
    ) {
      return {
        ...plan,
        evidenceStatus: "REQUESTED",
        attestationStatus:
          Array.isArray(plan.requiredAttestation) &&
          plan.requiredAttestation.length > 0
            ? "REQUESTED"
            : "NOT_REQUIRED"
      };
    }

    return plan;
  });

  responses.truvernRemediation = remediation;

  await prisma.$executeRawUnsafe(
    `
    update "ReviewResponse"
    set responses = $1::jsonb,
        "updatedAt" = now()
    where id = $2
    `,
    JSON.stringify(responses),
    row.id
  );

  console.log("Repair complete.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
