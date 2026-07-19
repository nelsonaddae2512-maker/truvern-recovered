const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.$queryRawUnsafe(`
    select
      "accessTier"::text as tier,
      count(*)::int as templates,
      sum((select count(*) from "AssessmentSection" s where s."templateId" = t.id))::int as sections,
      sum((select count(*) from "AssessmentQuestion" q where q."templateId" = t.id))::int as questions
    from "AssessmentTemplate" t
    where source = 'SYSTEM'::"TemplateSource"
      and origin = 'CATALOG'::"TemplateOrigin"
      and "isActive" = true
    group by "accessTier"
    order by tier
  `);

  console.dir(rows, { depth: null });
}

main().catch(console.error).finally(() => prisma.$disconnect());
