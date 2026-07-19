import prisma from "@/lib/prisma";

export async function runGovernanceReleaseGateEngine() {
  const assignments: any[] = await prisma.$queryRawUnsafe(`
    select distinct
      rp."reviewAssignmentId",
      rp."vendorId",
      rp."organizationId",
      wi.id as "workflowId"
    from "RemediationPackage" rp
    left join "WorkflowInstance" wi
      on wi."reviewAssignmentId" = rp."reviewAssignmentId"
     and wi."vendorId" = rp."vendorId"
     and wi.type = 'VENDOR_GOVERNANCE_REVIEW'
    where rp."reviewAssignmentId" is not null
  `);

  let checked = 0;
  let ready = 0;
  let blocked = 0;

  for (const assignment of assignments) {
    checked++;

    const rows: any[] = await prisma.$queryRawUnsafe(
      `
      select
        count(*)::int as "totalPackages",
        count(*) filter (
          where rp.status in ('APPROVED','COMPLETED')
            and coalesce(qi.payload->'releaseReadiness'->>'state', '') = 'READY_FOR_RELEASE'
        )::int as "readyPackages",
        count(*) filter (
          where coalesce(qi.payload->'releaseReadiness'->>'state', '') = 'RELEASE_BLOCKED'
             or rp.status not in ('APPROVED','COMPLETED')
        )::int as "blockedPackages"
      from "RemediationPackage" rp
      left join "WorkflowQueueItem" qi
        on qi.payload->>'remediationPackageId' = rp.id::text
      where rp."reviewAssignmentId" = $1
      `,
      assignment.reviewAssignmentId,
    );

    const totalPackages = Number(rows?.[0]?.totalPackages ?? 0);
    const readyPackages = Number(rows?.[0]?.readyPackages ?? 0);
    const blockedPackages = Number(rows?.[0]?.blockedPackages ?? 0);

    const isReady = totalPackages > 0 && readyPackages === totalPackages && blockedPackages === 0;
    const gateState = isReady ? "GOVERNANCE_RELEASE_READY" : "GOVERNANCE_RELEASE_BLOCKED";

    if (isReady) ready++;
    else blocked++;

    await prisma.$executeRawUnsafe(
      `
      update "WorkflowInstance"
      set
        "currentStage" = $1,
        payload = coalesce(payload, '{}'::jsonb) || $2::jsonb,
        "updatedAt" = now()
      where id = $3
      `,
      gateState,
      JSON.stringify({
        releaseGate: {
          checkedAt: new Date().toISOString(),
          state: gateState,
          totalPackages,
          readyPackages,
          blockedPackages,
        },
      }),
      assignment.workflowId,
    );

    if (isReady) {
      await prisma.$executeRawUnsafe(
        `
        insert into "WorkflowQueueItem" (
          "workflowId",
          "organizationId",
          "vendorId",
          "reviewAssignmentId",
          queue,
          status,
          priority,
          payload,
          "createdAt",
          "updatedAt"
        )
        select
          $1, $2, $3, $4,
          'GOVERNANCE_RELEASE_READY',
          'OPEN',
          95,
          $5::jsonb,
          now(),
          now()
        where not exists (
          select 1
          from "WorkflowQueueItem"
          where "reviewAssignmentId" = $4
            and queue = 'GOVERNANCE_RELEASE_READY'
            and status = 'OPEN'
        )
        `,
        assignment.workflowId,
        assignment.organizationId,
        assignment.vendorId,
        assignment.reviewAssignmentId,
        JSON.stringify({
          releaseAssignmentId: assignment.reviewAssignmentId,
          releaseGate: {
            state: gateState,
            totalPackages,
            readyPackages,
            blockedPackages,
          },
        }),
      );
    }

    await prisma.$executeRawUnsafe(
      `
      insert into "WorkflowEvent" (
        "workflowId",
        "organizationId",
        "vendorId",
        "reviewAssignmentId",
        type,
        actor,
        summary,
        payload,
        "createdAt"
      )
      values ($1, $2, $3, $4, $5, 'GOVERNANCE_RELEASE_GATE_ENGINE', $6, $7::jsonb, now())
      `,
      assignment.workflowId,
      assignment.organizationId,
      assignment.vendorId,
      assignment.reviewAssignmentId,
      gateState,
      isReady
        ? 'Assignment passed governance release gate.'
        : 'Assignment remains blocked before governance release.',
      JSON.stringify({
        totalPackages,
        readyPackages,
        blockedPackages,
      }),
    );
  }

  return {
    ok: true,
    checked,
    ready,
    blocked,
  };
}
