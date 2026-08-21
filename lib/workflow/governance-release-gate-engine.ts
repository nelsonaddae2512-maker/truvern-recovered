import {
  ensureGovernanceReleaseReadyQueueItem,
  insertGovernanceReleaseGateEvent,
  readGovernanceReleaseGateAssignments,
  readGovernanceReleaseGateCounts,
  updateGovernanceReleaseGateStage,
} from "@/lib/repositories/governance-release-gate-repository";

export async function runGovernanceReleaseGateEngine() {
  const assignments: any[] =
    await readGovernanceReleaseGateAssignments();

  let checked = 0;
  let ready = 0;
  let blocked = 0;

  for (const assignment of assignments) {
    checked++;

    const rows: any[] = await readGovernanceReleaseGateCounts(
      assignment.reviewAssignmentId,
    );

    const totalPackages = Number(rows?.[0]?.totalPackages ?? 0);
    const readyPackages = Number(rows?.[0]?.readyPackages ?? 0);
    const blockedPackages = Number(rows?.[0]?.blockedPackages ?? 0);

    const isReady = totalPackages > 0 && readyPackages === totalPackages && blockedPackages === 0;
    const gateState = isReady ? "GOVERNANCE_RELEASE_READY" : "GOVERNANCE_RELEASE_BLOCKED";

    if (isReady) ready++;
    else blocked++;

    await updateGovernanceReleaseGateStage(
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
      await ensureGovernanceReleaseReadyQueueItem(
        assignment.workflowId,
        assignment.organizationId,
        assignment.vendorId,
        assignment.reviewAssignmentId,
        JSON.stringify({
          releaseGate: {
            state: gateState,
            totalPackages,
            readyPackages,
            blockedPackages,
          },
        }),
      );
    }

    await insertGovernanceReleaseGateEvent(
      assignment.workflowId,
      assignment.organizationId,
      assignment.vendorId,
      assignment.reviewAssignmentId,
      gateState,
      isReady
        ? "Assignment passed governance release gate."
        : "Assignment remains blocked before governance release.",
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
