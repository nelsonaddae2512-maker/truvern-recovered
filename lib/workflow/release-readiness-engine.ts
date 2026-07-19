import prisma from "@/lib/prisma";

export async function runReleaseReadinessEngine() {
  const packages: any[] = await prisma.$queryRawUnsafe(`
    select
      rp.id as "packageId",
      rp."reviewAssignmentId",
      rp."vendorId",
      rp."organizationId",
      rp.status as "packageStatus",
      rp.title as "packageTitle",
      qi.id as "queueItemId",
      qi."workflowId",
      qi.queue,
      qi.status as "queueStatus",
      qi.payload
    from "RemediationPackage" rp
    left join "WorkflowQueueItem" qi
      on qi.payload->>'remediationPackageId' = rp.id::text
    where qi.status = 'OPEN'
      and qi.queue = 'READY_FOR_RELEASE_CHECK'
      and rp.status in ('APPROVED','COMPLETED')
  `);

  let checked = 0;
  let ready = 0;
  let blocked = 0;

  for (const pkg of packages) {
    checked++;

    const taskRows: any[] = await prisma.$queryRawUnsafe(
      `
      select
        count(*)::int as total,
        count(*) filter (where status = 'COMPLETED')::int as completed,
        count(*) filter (where status not in ('COMPLETED','CANCELLED'))::int as open
      from "WorkflowTask"
      where "packageId" = $1
        and status <> 'CANCELLED'
      `,
      pkg.packageId,
    );

    const totalTasks = Number(taskRows?.[0]?.total ?? 0);
    const completedTasks = Number(taskRows?.[0]?.completed ?? 0);
    const openTasks = Number(taskRows?.[0]?.open ?? 0);

    const isReady = totalTasks === 0 || openTasks === 0;

    if (isReady) ready++;
    else blocked++;

    const readinessState = isReady ? "READY_FOR_RELEASE" : "RELEASE_BLOCKED";

    await prisma.$executeRawUnsafe(
      `
      update "WorkflowQueueItem"
      set
        payload = coalesce(payload, '{}'::jsonb) || $1::jsonb,
        "updatedAt" = now()
      where id = $2
      `,
      JSON.stringify({
        releaseReadiness: {
          checkedAt: new Date().toISOString(),
          state: readinessState,
          totalTasks,
          completedTasks,
          openTasks,
        },
      }),
      pkg.queueItemId,
    );

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
      values ($1, $2, $3, $4, $5, 'RELEASE_READINESS_ENGINE', $6, $7::jsonb, now())
      `,
      pkg.workflowId,
      pkg.organizationId,
      pkg.vendorId,
      pkg.reviewAssignmentId,
      readinessState,
      isReady
        ? 'Package passed release readiness check.'
        : 'Package blocked from release because workflow tasks remain open.',
      JSON.stringify({
        packageId: pkg.packageId,
        packageTitle: pkg.packageTitle,
        totalTasks,
        completedTasks,
        openTasks,
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
