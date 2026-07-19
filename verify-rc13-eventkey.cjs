const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.$queryRawUnsafe(`
    select column_name, data_type
    from information_schema.columns
    where table_name = 'TruvernCreditLedgerEntry'
      and column_name = 'eventKey'
  `);

  console.table(rows);

  if (!rows.length) {
    throw new Error('eventKey column was not created.');
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
