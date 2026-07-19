const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const enumRows = await prisma.$queryRawUnsafe(`
    select e.enumlabel as value
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    where t.typname = 'QuestionType'
    order by e.enumsortorder
  `);

  const values = enumRows.map((r) => String(r.value));
  const questionType =
    values.includes("SELECT") ? "SELECT" :
    values.includes("SINGLE_SELECT") ? "SINGLE_SELECT" :
    values.includes("RADIO") ? "RADIO" :
    values.includes("YES_NO") ? "YES_NO" :
    values.includes("BOOLEAN") ? "BOOLEAN" :
    null;

  if (!questionType) {
    throw new Error(`No supported Yes/No-style QuestionType found. Available: ${values.join(", ")}`);
  }

  const richRows = await prisma.$queryRawUnsafe(`
    select e.enumlabel as value
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    where t.typname = 'RichQuestionType'
    order by e.enumsortorder
  `);

  const richValues = richRows.map((r) => String(r.value));
  const richType =
    richValues.includes(questionType) ? questionType :
    richValues.includes("SELECT") ? "SELECT" :
    richValues.includes("SINGLE_SELECT") ? "SINGLE_SELECT" :
    richValues.includes("RADIO") ? "RADIO" :
    richValues.includes("TEXT") ? "TEXT" :
    richValues[0] || null;

  const options = [
    { label: "Yes", value: "YES", score: 1 },
    { label: "Partial", value: "PARTIAL", score: 0.5 },
    { label: "No", value: "NO", score: 0 },
    { label: "Not Applicable", value: "NA", score: null }
  ];

  await prisma.$executeRawUnsafe(`
    update "AssessmentQuestion" q
    set
      type = $1::"QuestionType",
      "richType" = case
        when $2::text is null then "richType"
        else $2::"RichQuestionType"
      end,
      options = $3::jsonb,
      "updatedAt" = now()
    from "AssessmentTemplate" t
    where q."templateId" = t.id
      and t.name = 'Truvern NIST 800-53 Governance Review'
  `, questionType, richType, JSON.stringify(options));

  const result = await prisma.$queryRawUnsafe(`
    select
      q.type::text as type,
      q."richType"::text as "richType",
      q.options,
      count(*)::int as count
    from "AssessmentQuestion" q
    join "AssessmentTemplate" t on t.id = q."templateId"
    where t.name = 'Truvern NIST 800-53 Governance Review'
    group by q.type::text, q."richType"::text, q.options
  `);

  console.dir(result, { depth: null });
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
