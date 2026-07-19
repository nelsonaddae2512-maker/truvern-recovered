const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe(`
    create table if not exists "AssessmentAnswer" (
      "id" serial primary key,
      "assessmentId" integer not null references "Assessment"("id") on delete cascade,
      "questionId" integer not null references "AssessmentQuestion"("id") on delete cascade,
      "value" text,
      "valueJson" jsonb,
      "riskImpact" integer,
      "createdAt" timestamp(3) not null default current_timestamp,
      "updatedAt" timestamp(3) not null default current_timestamp,
      constraint "AssessmentAnswer_assessmentId_questionId_key"
        unique ("assessmentId", "questionId")
    )
  `);

  console.log("AssessmentAnswer table ready.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
