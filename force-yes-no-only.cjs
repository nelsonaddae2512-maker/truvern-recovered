const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {

  await prisma.$executeRawUnsafe(`
    update "AssessmentQuestion" q
    set
      type = 'YES_NO'::"QuestionType",
      options = '[
        {"label":"Yes","value":"YES"},
        {"label":"No","value":"NO"},
        {"label":"Partial","value":"PARTIAL"},
        {"label":"Not Applicable","value":"NA"}
      ]'::jsonb,
      "updatedAt" = now()
    from "AssessmentTemplate" t
    where q."templateId" = t.id
      and t.name = 'Truvern NIST 800-53 Governance Review'
  `);

  console.log("Updated.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
