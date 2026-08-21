import {
  insertReleaseReadinessEvent,
  readReleaseReadinessPackages,
  readReleaseReadinessTaskCounts,
  updateReleaseReadinessQueueItem,
} from "@/lib/repositories/release-readiness-repository";

export async function runReleaseReadinessEngine() {
  const packages: any[] =
    await readReleaseReadinessPackages();

  let checked = 0;
  let ready = 0;
  let blocked = 0;

  for (const pkg of packages) {
    checked++;

    const taskRows: any[] = await readReleaseReadinessTaskCounts(
      pkg.packageId,
    );

    const totalTasks = Number(taskRows?.[0]?.total ?? 0);
    const completedTasks = Number(taskRows?.[0]?.completed ?? 0);
    const openTasks = Number(taskRows?.[0]?.open ?? 0);

    const isReady = totalTasks === 0 || openTasks === 0;

    if (isReady) ready++;
    else blocked++;

    const readinessState = isReady ? "READY_FOR_RELEASE" : "RELEASE_BLOCKED";

    await updateReleaseReadinessQueueItem(
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

    await insertReleaseReadinessEvent(
      pkg.workflowId,
      pkg.organizationId,
      pkg.vendorId,
      pkg.reviewAssignmentId,
      readinessState,
      isReady
        ? "Package passed release readiness check."
        : "Package blocked from release because workflow tasks remain open.",
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
