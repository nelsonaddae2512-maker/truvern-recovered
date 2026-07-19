const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.$queryRawUnsafe(`
    select tq."controlId", tq.prompt, count(*)::int as count
    from "TruvernControlQuestion" tq
    group by tq."controlId", tq.prompt
    having count(*) > 1
    order by count desc
  `);

  console.dir(rows, { depth: null });
}

main().finally(() => prisma.$disconnect());
