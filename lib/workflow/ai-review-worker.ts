import { completeWorkflowTask } from "@/lib/workflow/workflow-task-engine";
import { resolveOrganizationPlanTier } from "@/lib/billing/organization-plan";
import {
  DEFAULT_OPENAI_REMEDIATION_REVIEW_MODEL,
  OPENAI_REMEDIATION_REVIEW_PROVIDER_VERSION,
  requestOpenAiRemediationReview,
} from "@/lib/workflow/remediation-review-openai-provider";
import {
  evaluateRemediationReviewCommercialEligibility,
  getConfiguredRemediationReviewApiKey,
  getConfiguredRemediationReviewModel,
  isRemediationReviewRuntimeEnabled,
} from "@/lib/workflow/remediation-review-runtime-config";
import {
  extractTrustedEvidenceText,
  readTrustedVendorEvidenceObject,
} from "@/lib/storage/evidence-storage";
import {
  createHumanReviewRequiredResult,
  createRemediationReviewInput,
} from "@/lib/workflow/remediation-review-contract";
import {
  insertAiReviewWorkerCompletionEvent,
  readAiReviewWorkerTasks,
  readAiReviewWorkerTasksForPackage,
  updateAiReviewWorkerTask,
} from "@/lib/repositories/ai-review-worker-repository";

const AI_REMEDIATION_REVIEW_TEXT_MAX_CHARS = 65_536;

function boundRemediationReviewEvidenceText(
  text: string | null,
): {
  text: string | null;
  originalCharacterLength: number | null;
  suppliedCharacterLength: number | null;
  truncated: boolean;
} {
  if (text == null) {
    return {
      text: null,
      originalCharacterLength: null,
      suppliedCharacterLength: null,
      truncated: false,
    };
  }

  const originalCharacterLength = text.length;
  const boundedText =
    originalCharacterLength > AI_REMEDIATION_REVIEW_TEXT_MAX_CHARS
      ? text.slice(0, AI_REMEDIATION_REVIEW_TEXT_MAX_CHARS)
      : text;

  return {
    text: boundedText,
    originalCharacterLength,
    suppliedCharacterLength: boundedText.length,
    truncated:
      originalCharacterLength > AI_REMEDIATION_REVIEW_TEXT_MAX_CHARS,
  };
}
async function runAiReviewTasks(tasks: any[]) {
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

    const evidenceContext: {
      status:
        | "NOT_AVAILABLE"
        | "TEXT_AVAILABLE"
        | "UNSUPPORTED_MEDIA_TYPE"
        | "EMPTY_TEXT"
        | "READ_FAILED";
      evidenceRequestId: number | null;
      fulfilledEvidenceId: number | null;
      evidenceId: number | null;
      evidenceKind: string | null;
      mediaType: string | null;
      byteLength: number | null;
      text: string | null;
      error: string | null;
    } = {
      status: "NOT_AVAILABLE",
      evidenceRequestId:
        task.evidenceRequestId == null ? null : Number(task.evidenceRequestId),
      fulfilledEvidenceId:
        task.fulfilledEvidenceId == null ? null : Number(task.fulfilledEvidenceId),
      evidenceId: task.evidenceId == null ? null : Number(task.evidenceId),
      evidenceKind:
        typeof task.evidenceKind === "string" ? task.evidenceKind : null,
      mediaType: null,
      byteLength: null,
      text: null,
      error: null,
    };

    const evidenceStorageKey =
      typeof task.evidenceStorageKey === "string"
        ? task.evidenceStorageKey.trim()
        : "";

    const evidenceRequestId =
      task.evidenceRequestId == null
        ? null
        : Number(task.evidenceRequestId);

    const vendorId =
      task.vendorId == null
        ? null
        : Number(task.vendorId);

    if (
      evidenceStorageKey &&
      Number.isInteger(evidenceRequestId) &&
      Number.isInteger(vendorId)
    ) {
      try {
        const trustedObject = await readTrustedVendorEvidenceObject({
          key: evidenceStorageKey,
          vendorId: vendorId as number,
          evidenceRequestId: evidenceRequestId as number,
        });

        const extracted = extractTrustedEvidenceText(trustedObject);

        evidenceContext.status = extracted.extractionStatus;
        evidenceContext.mediaType = extracted.mediaType;
        evidenceContext.byteLength = extracted.byteLength;
        evidenceContext.text = extracted.text;
      } catch (error) {
        evidenceContext.status = "READ_FAILED";
        evidenceContext.error =
          error instanceof Error
            ? error.message
            : "Trusted evidence read failed.";
      }
    }

    const boundedEvidenceText =
      boundRemediationReviewEvidenceText(
        evidenceContext.text,
      );
    const reviewInput = createRemediationReviewInput({
      taskId: Number(task.id),
      packageId: Number(task.packageId),
      workflowId: Number(task.workflowId),
      queueItemId:
        task.queueItemId == null
          ? null
          : Number(task.queueItemId),
      reviewAssignmentId: Number(task.reviewAssignmentId),
      vendorId: Number(task.vendorId),
      organizationId: Number(task.organizationId),
      sourceKey:
        typeof task.sourceKey === "string"
          ? task.sourceKey
          : null,
      severity:
        typeof task.packageSeverity === "string"
          ? task.packageSeverity
          : null,
      questionPrompt:
        typeof packagePayload.questionPrompt === "string"
          ? packagePayload.questionPrompt
          : null,
      title:
        typeof packagePayload.title === "string"
          ? packagePayload.title
          : null,
      summary:
        typeof packagePayload.summary === "string"
          ? packagePayload.summary
          : null,
      requiredEvidence,
      requiredAttestations,
      remediationRecommendation:
        typeof packagePayload.recommendation === "string"
          ? packagePayload.recommendation
          : null,
      releaseImpact:
        typeof packagePayload.releaseImpact === "string"
          ? packagePayload.releaseImpact
          : null,
      evidenceSignal:
        typeof packagePayload.evidenceSignal === "string"
          ? packagePayload.evidenceSignal
          : null,
      evidenceRequestId:
        evidenceContext.evidenceRequestId,
      fulfilledEvidenceId:
        evidenceContext.fulfilledEvidenceId,
      evidenceRequestTitle:
        typeof task.evidenceRequestTitle === "string"
          ? task.evidenceRequestTitle
          : null,
      evidenceRequestDescription:
        typeof task.evidenceRequestDescription === "string"
          ? task.evidenceRequestDescription
          : null,
      vendorResponse:
        typeof task.vendorResponse === "string"
          ? task.vendorResponse
          : null,
      reviewerNotes:
        typeof task.reviewerNotes === "string"
          ? task.reviewerNotes
          : null,
      resolutionNotes:
        typeof task.resolutionNotes === "string"
          ? task.resolutionNotes
          : null,
      evidenceId:
        evidenceContext.evidenceId,
      evidenceTitle:
        typeof task.evidenceTitle === "string"
          ? task.evidenceTitle
          : null,
      evidenceDescription:
        typeof task.evidenceDescription === "string"
          ? task.evidenceDescription
          : null,
      evidenceStorageKey:
        evidenceStorageKey || null,
      evidenceKind:
        evidenceContext.evidenceKind,
      evidenceUploadedAt:
        task.evidenceUploadedAt ?? null,
      evidenceDocumentDate:
        task.evidenceDocumentDate ?? null,
      evidenceValidUntil:
        task.evidenceValidUntil ?? null,
      evidenceContext: {
        status: evidenceContext.status,
        contentType: evidenceContext.mediaType,
        contentLength: evidenceContext.byteLength,
        text: boundedEvidenceText.text,
        reason:
          evidenceContext.status === "READ_FAILED"
            ? "Trusted evidence could not be read."
            : null,
      },
    });

    const assignmentType =
      typeof task.assignmentType === "string"
        ? task.assignmentType.trim().toUpperCase()
        : "";

    let organizationPlanTier:
      | Awaited<ReturnType<typeof resolveOrganizationPlanTier>>
      | null = null;

    if (assignmentType === "INTERNAL") {
      organizationPlanTier =
        await resolveOrganizationPlanTier(
          Number(task.organizationId),
        );
    }

    const commercialEligibility =
      evaluateRemediationReviewCommercialEligibility({
        assignmentType,
        organizationPlanTier,
      });

    const runtimeEnabled =
      isRemediationReviewRuntimeEnabled();

    const configuredApiKey =
      getConfiguredRemediationReviewApiKey();

    const configuredModel =
      getConfiguredRemediationReviewModel();

    let reviewResult =
      createHumanReviewRequiredResult({
        rationale:
          !commercialEligibility.eligible
            ? "Automated remediation review is unavailable for this review entitlement. Human reviewer validation remains required."
            : !runtimeEnabled
              ? "Automated remediation review is operationally disabled. Human reviewer validation remains required."
              : !configuredApiKey
                ? "Automated remediation review provider configuration is unavailable. Human reviewer validation remains required."
                : "Automated remediation review did not complete. Human reviewer validation remains required.",
        confidence: 0.72,
        evidenceSufficiency:
          "NOT_ASSESSABLE",
        requirementCoverage:
          "NOT_ASSESSABLE",
        suggestedReviewerFocus: [
          "Confirm uploaded evidence matches each required evidence item.",
          "Validate attestation ownership and authority.",
          "Check evidence freshness and relevance before approval.",
        ],
      });

    let providerMetadata: {
      attempted: boolean;
      providerVersion: string | null;
      model: string | null;
      providerRequestId: string | null;
      usage: {
        inputTokens: number | null;
        outputTokens: number | null;
        totalTokens: number | null;
      } | null;
      failureCode: string | null;
    } = {
      attempted: false,
      providerVersion: null,
      model: null,
      providerRequestId: null,
      usage: null,
      failureCode: null,
    };

    if (
      commercialEligibility.eligible &&
      runtimeEnabled &&
      configuredApiKey
    ) {
      providerMetadata = {
        attempted: true,
        providerVersion:
          OPENAI_REMEDIATION_REVIEW_PROVIDER_VERSION,
        model:
          configuredModel ??
          DEFAULT_OPENAI_REMEDIATION_REVIEW_MODEL,
        providerRequestId: null,
        usage: null,
        failureCode: null,
      };

      try {
        const providerResponse =
          await requestOpenAiRemediationReview(
            reviewInput,
            {
              apiKey: configuredApiKey,
              model: configuredModel,
            },
          );

        reviewResult =
          providerResponse.result;

        providerMetadata = {
          attempted: true,
          providerVersion:
            OPENAI_REMEDIATION_REVIEW_PROVIDER_VERSION,
          model:
            providerResponse.model,
          providerRequestId:
            providerResponse.providerRequestId,
          usage:
            providerResponse.usage,
          failureCode: null,
        };
      }
      catch {
        providerMetadata = {
          ...providerMetadata,
          failureCode:
            "PROVIDER_REQUEST_FAILED",
        };
      }
    }
    const result = {
      aiReviewVersion:
        providerMetadata.attempted &&
        providerMetadata.failureCode == null
          ? OPENAI_REMEDIATION_REVIEW_PROVIDER_VERSION
          : "TRV-AI-REVIEW-STUB-1.0",
      ...reviewResult,
      commercialEligibility,
      runtimeEnabled,
      provider: providerMetadata,
      evidenceChecklistCount: requiredEvidence.length,
      attestationChecklistCount: requiredAttestations.length,
      evidenceContext: {
        status: evidenceContext.status,
        evidenceRequestId: evidenceContext.evidenceRequestId,
        fulfilledEvidenceId: evidenceContext.fulfilledEvidenceId,
        evidenceId: evidenceContext.evidenceId,
        evidenceKind: evidenceContext.evidenceKind,
        mediaType: evidenceContext.mediaType,
        byteLength: evidenceContext.byteLength,
        textAvailable: evidenceContext.text != null,
        originalCharacterLength:
          boundedEvidenceText.originalCharacterLength,
        suppliedCharacterLength:
          boundedEvidenceText.suppliedCharacterLength,
        truncated: boundedEvidenceText.truncated,
        error:
          evidenceContext.status === "READ_FAILED"
            ? "TRUSTED_EVIDENCE_READ_FAILED"
            : null,
      },
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

export async function runAiReviewWorker() {
  const tasks: any[] =
    await readAiReviewWorkerTasks();

  return runAiReviewTasks(tasks);
}

export async function runAiReviewWorkerForPackage(
  packageId: number,
) {
  const tasks: any[] =
    await readAiReviewWorkerTasksForPackage(packageId);

  return runAiReviewTasks(tasks);
}