import { completeWorkflowTask } from "@/lib/workflow/workflow-task-engine";
import {
  insertAiReviewWorkerCompletionEvent,
  readAiReviewWorkerTasks,
  updateAiReviewWorkerTask,
} from "@/lib/repositories/ai-review-worker-repository";

export async function runAiReviewWorker() {
  const tasks: any[] =
    await readAiReviewWorkerTasks();

  let completed = 0;

  for (const task of tasks) {
    const packagePayload =
      task.packagePayload && typeof task.packagePayload === "object"
        ? task.packagePayload
        : {};

    const requiredEvidence = Array.isArray(packagePayload.requiredEvidence)
      ? packagePayload.requiredEvidence
      : [];

    const requiredAttestations = Array.isArray(packagePayload.requiredAttestations)
      ? packagePayload.requiredAttestations
      : [];

    const result = {
      aiReviewVersion: "TRV-AI-REVIEW-STUB-1.0",
      recommendation: "HUMAN_REVIEW_REQUIRED",
      confidence: 0.72,
      evidenceChecklistCount: requiredEvidence.length,
      attestationChecklistCount: requiredAttestations.length,
      suggestedReviewerFocus: [
        "Confirm uploaded evidence matches each required evidence item.",
        "Validate attestation ownership and authority.",
        "Check evidence freshness and relevance before approval.",
      ],
      generatedAt: new Date().toISOString(),
    };

    await updateAiReviewWorkerTask(
      JSON.stringify({ aiReview: result }),
      task.id,
    );

    await completeWorkflowTask({
      taskId: Number(task.id),
      result: "AI_PRE_REVIEW_COMPLETED",
      notes: JSON.stringify(result),
    });

    await insertAiReviewWorkerCompletionEvent(
      task.workflowId,
      task.organizationId,
      task.vendorId,
      task.reviewAssignmentId,
      JSON.stringify({
        taskId: task.id,
        packageId: task.packageId,
        result,
      }),
    );

    completed++;
  }

  return {
    ok: true,
    checked: tasks.length,
    completed,
  };
}
