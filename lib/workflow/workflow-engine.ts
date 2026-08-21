import {
  createWorkflowInstanceRow,
  insertRemediationActivity,
  insertWorkflowTransitionEvent,
  readWorkflowPackage,
  updateRemediationPackageStatus,
  updateWorkflowInstanceStage,
  updateWorkflowQueueForPackage,
} from "@/lib/repositories/workflow-engine-repository";

export type WorkflowEventType =
  | "EVIDENCE_UPLOADED"
  | "PACKAGE_SUBMITTED"
  | "REVIEW_STARTED"
  | "PACKAGE_APPROVED"
  | "MORE_INFORMATION_REQUESTED"
  | "PACKAGE_COMPLETED"
  | "ASSESSMENT_RELEASED";

type TransitionInput = {
  workflowId?: number | null;
  packageId?: number | null;
  reviewAssignmentId?: number | null;
  vendorId?: number | null;
  organizationId?: number | null;
  event: WorkflowEventType;
  actor?: string | null;
  summary?: string | null;
  payload?: Record<string, any>;
};

function queueForEvent(event: WorkflowEventType) {
  switch (event) {
    case "EVIDENCE_UPLOADED":
    case "PACKAGE_SUBMITTED":
      return "EVIDENCE_WAITING_REVIEW";

    case "REVIEW_STARTED":
      return "UNDER_TRUVERN_REVIEW";

    case "MORE_INFORMATION_REQUESTED":
      return "VENDOR_WAITING_RESPONSE";

    case "PACKAGE_APPROVED":
    case "PACKAGE_COMPLETED":
      return "READY_FOR_RELEASE_CHECK";

    case "ASSESSMENT_RELEASED":
      return "COMPLETE";

    default:
      return "VENDOR_WAITING_RESPONSE";
  }
}

function packageStatusForEvent(event: WorkflowEventType) {
  switch (event) {
    case "EVIDENCE_UPLOADED":
    case "PACKAGE_SUBMITTED":
      return "SUBMITTED";

    case "REVIEW_STARTED":
      return "IN_REVIEW";

    case "MORE_INFORMATION_REQUESTED":
      return "NEEDS_MORE";

    case "PACKAGE_APPROVED":
      return "APPROVED";

    case "PACKAGE_COMPLETED":
      return "COMPLETED";

    default:
      return null;
  }
}

export async function workflowTransition(input: TransitionInput) {
  const payload = input.payload ?? {};

  const packageRows: any[] = input.packageId
    ? await readWorkflowPackage(
        input.packageId,
      )
    : [];

  const pkg = packageRows[0] ?? null;

  const workflowId = input.workflowId ?? pkg?.workflowId ?? null;
  const reviewAssignmentId = input.reviewAssignmentId ?? pkg?.reviewAssignmentId ?? null;
  const vendorId = input.vendorId ?? pkg?.vendorId ?? null;
  const organizationId = input.organizationId ?? pkg?.organizationId ?? null;
  const queue = queueForEvent(input.event);
  const packageStatus = packageStatusForEvent(input.event);
  const summary = input.summary ?? input.event.replaceAll("_", " ").toLowerCase();

  if (!organizationId) {
    throw new Error("organizationId is required for workflow transition.");
  }

  let finalWorkflowId = workflowId;

  if (!finalWorkflowId) {
    const created: any[] = await createWorkflowInstanceRow(
      organizationId,
      vendorId,
      reviewAssignmentId,
      queue,
      JSON.stringify({ createdBy: "WorkflowEngine" }),
    );

    finalWorkflowId = Number(created[0].id);
  }

  await insertWorkflowTransitionEvent(
    finalWorkflowId,
    organizationId,
    vendorId,
    reviewAssignmentId,
    input.event,
    input.actor ?? "SYSTEM",
    summary,
    JSON.stringify(payload),
  );

  await updateWorkflowInstanceStage(
    queue,
    finalWorkflowId,
  );

  if (input.packageId && packageStatus) {
    await updateRemediationPackageStatus(
      packageStatus,
      input.packageId,
    );
  }

  if (input.packageId) {
    await updateWorkflowQueueForPackage(
      queue,
      finalWorkflowId,
      String(input.packageId),
    );

    await insertRemediationActivity(
      input.packageId,
      finalWorkflowId,
      reviewAssignmentId,
      vendorId,
      organizationId,
      input.event,
      summary,
      input.actor ?? "SYSTEM",
      JSON.stringify(payload),
    );
  }

  return {
    ok: true,
    workflowId: finalWorkflowId,
    queue,
    packageStatus,
  };
}
