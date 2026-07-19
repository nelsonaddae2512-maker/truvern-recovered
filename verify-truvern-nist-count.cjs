const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.$queryRawUnsafe(`
    select
      t.id,
      t.name,
      t.source::text as source,
      t."accessTier"::text as "accessTier",
      count(distinct s.id)::int as sections,
      count(distinct q.id)::int as questions
    from "AssessmentTemplate" t
    left join "AssessmentSection" s on s."templateId" = t.id
    left join "AssessmentQuestion" q on q."templateId" = t.id
    where t.name = 'Truvern NIST 800-53 Governance Review'
    group by t.id
  `);

  console.dir(rows, { depth: null });
}

main().finally(() => prisma.$disconnect());
