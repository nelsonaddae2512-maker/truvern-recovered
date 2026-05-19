const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe(`
    do $$
    begin
      if not exists (select 1 from pg_type where typname = 'TemplateAccessTier') then
        create type "TemplateAccessTier" as enum ('FREE', 'PRO', 'ENTERPRISE');
      end if;

      if not exists (select 1 from pg_type where typname = 'TemplateSource') then
        create type "TemplateSource" as enum ('SYSTEM', 'CUSTOM');
      end if;
    end $$;
  `);

  await prisma.$executeRawUnsafe(`
    alter table "AssessmentTemplate"
      add column if not exists "source" "TemplateSource" not null default 'CUSTOM',
      add column if not exists "accessTier" "TemplateAccessTier",
      add column if not exists "isSystem" boolean not null default false,
      add column if not exists "isFeatured" boolean not null default false;
  `);

  console.log("Assessment catalog access fields applied safely.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
