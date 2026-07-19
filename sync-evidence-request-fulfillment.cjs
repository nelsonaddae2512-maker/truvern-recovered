const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const result = await prisma.$executeRawUnsafe(`
    update "EvidenceRequest" er
    set
      status = 'RECEIVED'::"EvidenceRequestStatus",
      "fulfilledEvidenceId" = e.id,
      "fulfilledAt" = coalesce(er."fulfilledAt", e."createdAt", now()),
      "updatedAt" = now()
    from (
      select distinct on ("evidenceRequestId")
        id,
        "evidenceRequestId",
        "createdAt"
      from "Evidence"
      where "evidenceRequestId" is not null
      order by "evidenceRequestId", "updatedAt" desc, id desc
    ) e
    where er.id = e."evidenceRequestId"
      and (
        er."fulfilledEvidenceId" is null
        or upper(coalesce(er.status::text, '')) in ('REQUESTED', 'PENDING', 'OPEN')
      )
  `);

  console.log("Synced EvidenceRequest rows:", result);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
