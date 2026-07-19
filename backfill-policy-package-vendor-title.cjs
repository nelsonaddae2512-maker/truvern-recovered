const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.$queryRawUnsafe(`
    select id, payload
    from "RemediationPackage"
    where "reviewAssignmentId" = 14
      and title = 'PL-2 / PM-9 Security Policy Review Governance Gap'
  `);

  for (const row of rows) {
    const payload = row.payload || {};
    payload.vendorTitle = "Provide your security policy and governance documentation";
    payload.vendorSummary =
      "We need evidence that your security expectations, responsibilities, and governance practices are documented and assigned to appropriate owners.";

    await prisma.$executeRawUnsafe(
      `
      update "RemediationPackage"
      set payload = $1::jsonb, "updatedAt" = now()
      where id = $2
      `,
      JSON.stringify(payload),
      row.id,
    );
  }

  console.log(`Updated ${rows.length} remediation package(s).`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
