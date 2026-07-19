export const WorkflowEvent = {
  EvidenceUploaded: "EVIDENCE_UPLOADED",
  PackageSubmitted: "PACKAGE_SUBMITTED",
  ReviewStarted: "REVIEW_STARTED",
  PackageApproved: "PACKAGE_APPROVED",
  MoreInformationRequested: "MORE_INFORMATION_REQUESTED",
  PackageCompleted: "PACKAGE_COMPLETED",
  AssessmentReleased: "ASSESSMENT_RELEASED",
} as const;

export type WorkflowEventType = (typeof WorkflowEvent)[keyof typeof WorkflowEvent];

export const WorkflowStage = {
  VendorWaitingResponse: "VENDOR_WAITING_RESPONSE",
  EvidenceWaitingReview: "EVIDENCE_WAITING_REVIEW",
  UnderTruvernReview: "UNDER_TRUVERN_REVIEW",
  ReadyForRelease: "READY_FOR_RELEASE_CHECK",
  Complete: "COMPLETE",
} as const;

export type WorkflowStageType = (typeof WorkflowStage)[keyof typeof WorkflowStage];

export const PackageStatus = {
  Requested: "REQUESTED",
  Submitted: "SUBMITTED",
  InReview: "IN_REVIEW",
  NeedsMore: "NEEDS_MORE",
  Approved: "APPROVED",
  Completed: "COMPLETED",
} as const;

export const QueueStatus = {
  Open: "OPEN",
  Closed: "CLOSED",
} as const;

export function stageForEvent(event: WorkflowEventType): WorkflowStageType {
  switch (event) {
    case WorkflowEvent.EvidenceUploaded:
    case WorkflowEvent.PackageSubmitted:
      return WorkflowStage.EvidenceWaitingReview;

    case WorkflowEvent.ReviewStarted:
      return WorkflowStage.UnderTruvernReview;

    case WorkflowEvent.MoreInformationRequested:
      return WorkflowStage.VendorWaitingResponse;

    case WorkflowEvent.PackageApproved:
    case WorkflowEvent.PackageCompleted:
      return WorkflowStage.ReadyForRelease;

    case WorkflowEvent.AssessmentReleased:
      return WorkflowStage.Complete;
  }
}

export function packageStatusForEvent(event: WorkflowEventType) {
  switch (event) {
    case WorkflowEvent.EvidenceUploaded:
    case WorkflowEvent.PackageSubmitted:
      return PackageStatus.Submitted;

    case WorkflowEvent.ReviewStarted:
      return PackageStatus.InReview;

    case WorkflowEvent.MoreInformationRequested:
      return PackageStatus.NeedsMore;

    case WorkflowEvent.PackageApproved:
      return PackageStatus.Approved;

    case WorkflowEvent.PackageCompleted:
      return PackageStatus.Completed;

    case WorkflowEvent.AssessmentReleased:
      return null;
  }
}

export function priorityForSeverity(value: unknown) {
  const severity = String(value ?? "").toUpperCase();

  if (severity === "CRITICAL") return 100;
  if (severity === "HIGH") return 85;
  if (severity === "MEDIUM") return 60;

  return 40;
}
