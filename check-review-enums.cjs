const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function enumValues(name) {
  return prisma.$queryRawUnsafe(`
    select e.enumlabel
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = '${name}'
    order by e.enumsortorder asc
  `);
}

async function main() {
  console.log("AssessmentStatus");
  console.dir(await enumValues("AssessmentStatus"), { depth: null });

  console.log("ReviewAssignmentStatus");
  console.dir(await enumValues("ReviewAssignmentStatus"), { depth: null });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
