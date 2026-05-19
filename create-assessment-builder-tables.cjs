const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe(`
    do $$
    begin
      if not exists (select 1 from pg_type where typname = 'QuestionType') then
        create type "QuestionType" as enum (
          'BOOLEAN',
          'TEXT',
          'MULTI_CHOICE',
          'YES_NO',
          'NUMBER',
          'MULTIPLE_CHOICE',
          'FILE_UPLOAD'
        );
      end if;
    end $$;
  `);

  await prisma.$executeRawUnsafe(`
    do $$
    begin
      if not exists (select 1 from pg_type where typname = 'AssessmentQuestionType') then
        create type "AssessmentQuestionType" as enum (
          'TEXT',
          'YES_NO',
          'SELECT',
          'MULTI_SELECT',
          'NUMBER'
        );
      end if;
    end $$;
  `);

  await prisma.$executeRawUnsafe(`
    create table if not exists "AssessmentSection" (
      "id" serial primary key,
      "templateId" integer not null references "AssessmentTemplate"("id") on delete cascade,
      "title" text not null,
      "description" text,
      "order" integer not null default 0,
      "weight" double precision
    );
  `);

  await prisma.$executeRawUnsafe(`
    create table if not exists "AssessmentQuestion" (
      "id" serial primary key,
      "templateId" integer references "AssessmentTemplate"("id") on delete set null,
      "sectionId" integer references "AssessmentSection"("id") on delete set null,
      "orderIndex" integer not null default 0,
      "text" text not null,
      "helpText" text,
      "description" text,
      "category" text,
      "type" "QuestionType" not null default 'TEXT',
      "richType" "AssessmentQuestionType",
      "required" boolean not null default false,
      "weight" integer,
      "key" text,
      "options" jsonb,
      "createdAt" timestamp(3) not null default current_timestamp,
      "updatedAt" timestamp(3) not null default current_timestamp
    );
  `);

  const rows = await prisma.$queryRawUnsafe(`
    select table_name
    from information_schema.tables
    where table_schema = 'public'
      and table_name in ('AssessmentTemplate','AssessmentSection','AssessmentQuestion')
    order by table_name
  `);

  console.table(rows);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
