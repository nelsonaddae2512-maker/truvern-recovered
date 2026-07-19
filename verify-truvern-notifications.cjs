const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.$queryRawUnsafe(`
    select
      id,
      "organizationId",
      "userId",
      type::text as type,
      severity::text as severity,
      title,
      message,
      "readAt",
      "createdAt",
      "metadataJson"
    from "Notification"
    where type::text = 'ASSESSMENT_ASSIGNED_TRUVERN'
       or title ilike '%Truvern%'
    order by id desc
    limit 20
  `);

  console.dir(rows, { depth: null });
}

main().finally(() => prisma.$disconnect());
