const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.$queryRawUnsafe(`
    update "EvidenceRequest"
    set
      status = 'CANCELLED'::"EvidenceRequestStatus",
      notes = coalesce(notes, '') || ' | Superseded by grouped remediation package.',
      "updatedAt" = now()
    where notes like 'Auto-created by Truvern Findings Engine.%'
      and status::text = 'REQUESTED'
      and not (
        lower(title) like '%governance gap%'
        or lower(title) like 'vendor must resolve:%'
      )
    returning id, title, status::text as status
  `);

  console.log("Cancelled exploded auto-remediation rows:");
  console.dir(rows, { depth: null });
}

main().catch(console.error).finally(() => prisma.$disconnect());
