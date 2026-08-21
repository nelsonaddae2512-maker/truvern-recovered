import {
  insertWorkflowSchedulerOverdueEvent,
  readWorkflowSchedulerOpenItems,
  updateWorkflowSchedulerQueueItem,
} from "@/lib/repositories/workflow-scheduler-repository";

type SchedulerResult = {
  checked: number;
  overdue: number;
  dueSoon: number;
  unclaimed: number;
};

export async function runWorkflowScheduler(): Promise<SchedulerResult> {
  const rows: any[] =
    await readWorkflowSchedulerOpenItems();

  let overdue = 0;
  let dueSoon = 0;
  let unclaimed = 0;

  for (const item of rows) {
    const dueAt = item.dueAt ? new Date(item.dueAt) : null;
    const now = new Date();

    let slaState = "NO_SLA";

    if (dueAt && !Number.isNaN(dueAt.getTime())) {
      const hoursRemaining = Math.ceil((dueAt.getTime() - now.getTime()) / (1000 * 60 * 60));

      if (hoursRemaining < 0) {
        slaState = "OVERDUE";
        overdue++;
      } else if (hoursRemaining <= 24) {
        slaState = "DUE_SOON";
        dueSoon++;
      } else {
        slaState = "ON_TRACK";
      }
    }

    if (!item.assignedTo) {
      unclaimed++;
    }

    await updateWorkflowSchedulerQueueItem(
      JSON.stringify({
        scheduler: {
          checkedAt: now.toISOString(),
          slaState,
          unclaimed: !item.assignedTo,
        },
      }),
      slaState === "OVERDUE"
        ? 95
        : slaState === "DUE_SOON"
          ? 80
          : item.priority,
      item.id,
    );

    if (slaState === "OVERDUE") {
      await insertWorkflowSchedulerOverdueEvent(
        item.workflowId,
        item.organizationId,
        item.vendorId,
        item.reviewAssignmentId,
        JSON.stringify({
          queueItemId: item.id,
          queue: item.queue,
        }),
      );
    }
  }

  return {
    checked: rows.length,
    overdue,
    dueSoon,
    unclaimed,
  };
}
