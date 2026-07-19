const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const options = [
  { label: "Yes", value: "YES", score: 1 },
  { label: "Partial", value: "PARTIAL", score: 0.5 },
  { label: "No", value: "NO", score: 0 },
  { label: "Not Applicable", value: "NA", score: null }
];

async function main() {
  await prisma.$executeRawUnsafe(`
    update "AssessmentQuestion" q
    set
      type = 'YES_NO'::"QuestionType",
      options = $1::jsonb,
      "updatedAt" = now()
    from "AssessmentTemplate" t
    where q."templateId" = t.id
      and t.name = 'Truvern NIST 800-53 Governance Review'
  `, JSON.stringify(options));

  await prisma.$executeRawUnsafe(`
    update "AssessmentQuestion" q
    set
      type = 'YES_NO'::"QuestionType",
      options = $1::jsonb,
      "updatedAt" = now()
    from "Assessment" a
    join "AssessmentTemplate" t on t.id = a."templateId"
    where q."templateId" = t.id
      and t.name = 'Truvern NIST 800-53 Governance Review'
  `, JSON.stringify(options));

  const rows = await prisma.$queryRawUnsafe(`
    select
      t.name,
      q.type::text as type,
      count(*)::int as count
    from "AssessmentQuestion" q
    join "AssessmentTemplate" t on t.id = q."templateId"
    where t.name = 'Truvern NIST 800-53 Governance Review'
    group by t.name, q.type::text
  `);

  console.dir(rows, { depth: null });

  const assessments = await prisma.$queryRawUnsafe(`
    select
      a.id,
      a.token,
      t.name,
      count(q.id)::int as "questionCount",
      min(q.type::text) as "minType",
      max(q.type::text) as "maxType"
    from "Assessment" a
    join "AssessmentTemplate" t on t.id = a."templateId"
    join "AssessmentQuestion" q on q."templateId" = t.id
    where t.name = 'Truvern NIST 800-53 Governance Review'
    group by a.id, a.token, t.name
    order by a.id desc
    limit 5
  `);

  console.dir(assessments, { depth: null });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
