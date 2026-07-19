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
  console.log("QuestionType values:", values);

  const preferred =
    values.includes("YES_NO") ? "YES_NO" :
    values.includes("BOOLEAN") ? "BOOLEAN" :
    values.includes("SINGLE_SELECT") ? "SINGLE_SELECT" :
    values.includes("SELECT") ? "SELECT" :
    values.includes("RADIO") ? "RADIO" :
    values[0];

  if (!preferred) throw new Error("No QuestionType enum values found.");

  const options =
    preferred === "YES_NO" || preferred === "BOOLEAN"
      ? []
      : [
          { label: "Yes", value: "YES" },
          { label: "No", value: "NO" },
          { label: "Partial", value: "PARTIAL" },
          { label: "Not Applicable", value: "NA" }
        ];

  await prisma.$executeRawUnsafe(`
    update "AssessmentQuestion" q
    set
      type = $1::"QuestionType",
      "richType" = case
        when exists (
          select 1
          from pg_type t
          join pg_enum e on e.enumtypid = t.oid
          where t.typname = 'RichQuestionType'
            and e.enumlabel = $1
        )
        then $1::"RichQuestionType"
        else "richType"
      end,
      options = $2::jsonb,
      "updatedAt" = now()
    from "AssessmentTemplate" t
    where q."templateId" = t.id
      and t.name = 'Truvern NIST 800-53 Governance Review'
  `, preferred, JSON.stringify(options));

  const rows = await prisma.$queryRawUnsafe(`
    select
      q.type::text as type,
      q."richType"::text as "richType",
      count(*)::int as count
    from "AssessmentQuestion" q
    join "AssessmentTemplate" t on t.id = q."templateId"
    where t.name = 'Truvern NIST 800-53 Governance Review'
    group by q.type::text, q."richType"::text
    order by count desc
  `);

  console.dir(rows, { depth: null });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
