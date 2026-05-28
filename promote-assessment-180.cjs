const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const assessmentId = 180;

  const a = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    select: {
      id: true,
      title: true,
      organizationId: true,
      vendorId: true,
      vendor: { select: { name: true } },
    },
  });

  if (!a) throw new Error("Assessment not found.");

  const existing = await prisma.$queryRawUnsafe(`
    select ra.id as "assignmentId", rr.id as "requestId"
    from "ReviewRequest" rr
    join "ReviewAssignment" ra on ra."reviewRequestId" = rr.id
    where rr."vendorId" = $1
      and rr."organizationId" = $2
      and ra.status in ('PENDING','IN_PROGRESS','SUBMITTED')
    order by ra.id desc
    limit 1
  `, a.vendorId, a.organizationId);

  if (existing[0]) {
    console.log("Already promoted:", existing[0]);
    return;
  }

  const request = await prisma.$queryRawUnsafe(`
    insert into "ReviewRequest" ("organizationId", "vendorId", title, note, status, "updatedAt")
    values ($1, $2, $3, $4, 'REQUESTED'::"ReviewRequestStatus", now())
    returning id
  `, a.organizationId, a.vendorId, `Assessment review · ${a.vendor.name}`, `Promoted from submitted assessment #${a.id}.`);

  const assignment = await prisma.$queryRawUnsafe(`
    insert into "ReviewAssignment" (
      "organizationId",
      "vendorId",
      "reviewRequestId",
      "assignmentType",
      "status",
      "note",
      "updatedAt"
    )
    values (
      $1,
      $2,
      $3,
      'INTERNAL',
      'PENDING'::"ReviewAssignmentStatus",
      $4,
      now()
    )
    returning id
  `, a.organizationId, a.vendorId, request[0].id, `Submitted assessment #${a.id} is ready for review.`);

  console.log({
    requestId: request[0].id,
    assignmentId: assignment[0].id,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
