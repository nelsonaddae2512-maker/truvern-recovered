import crypto from "node:crypto";

export type FrameworkReleaseSnapshot = {
  schema: "truvern.frameworkAssessment.release.v1";
  generatedAt: string;
  assessment: unknown;
  framework: unknown;
  responses: unknown[];
  findings: unknown[];
  remediation: unknown[];
  attestations: unknown[];
  evidence: unknown[];
};

export function stableJson(value: unknown): string {
  return JSON.stringify(sortJson(value));
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJson);

  if (value && typeof value === "object") {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = sortJson((value as Record<string, unknown>)[key]);
        return acc;
      }, {});
  }

  return value;
}

export function checksumSnapshot(snapshot: FrameworkReleaseSnapshot) {
  return crypto.createHash("sha256").update(stableJson(snapshot)).digest("hex");
}

function evidenceFiles(value: unknown): any[] {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object" && Array.isArray((value as any).files)) {
    return (value as any).files;
  }
  return [];
}

function collectEvidence(assessment: any) {
  const evidence: any[] = [];

  for (const response of assessment.responses ?? []) {
    for (const file of evidenceFiles(response.evidence)) {
      evidence.push({
        scope: "response",
        evidenceId: file.evidenceId,
        filename: file.filename,
        bucket: file.bucket,
        region: file.region,
        key: file.key,
        contentType: file.contentType,
        sizeBytes: file.sizeBytes,
        status: file.status,
        responseId: response.id,
        questionId: response.questionId,
        controlId: response.question?.control?.controlId ?? null,
        controlTitle: response.question?.control?.title ?? null,
        createdAt: file.createdAt,
      });
    }
  }

  for (const finding of assessment.findings ?? []) {
    for (const remediation of finding.remediations ?? []) {
      const metadata =
        remediation.metadata && typeof remediation.metadata === "object"
          ? remediation.metadata
          : {};

      for (const file of evidenceFiles((metadata as any).evidence)) {
        evidence.push({
          scope: "remediation",
          evidenceId: file.evidenceId,
          filename: file.filename,
          bucket: file.bucket,
          region: file.region,
          key: file.key,
          contentType: file.contentType,
          sizeBytes: file.sizeBytes,
          status: file.status,
          findingId: finding.id,
          remediationId: remediation.id,
          findingTitle: finding.title,
          createdAt: file.createdAt,
        });
      }
    }
  }

  for (const attestation of assessment.attestations ?? []) {
    for (const file of evidenceFiles(attestation.evidence)) {
      evidence.push({
        scope: "attestation",
        evidenceId: file.evidenceId,
        filename: file.filename,
        bucket: file.bucket,
        region: file.region,
        key: file.key,
        contentType: file.contentType,
        sizeBytes: file.sizeBytes,
        status: file.status,
        attestationId: attestation.id,
        attestationTitle: attestation.title,
        createdAt: file.createdAt,
      });
    }
  }

  return evidence.sort((a, b) =>
    String(a.evidenceId ?? a.key ?? "").localeCompare(String(b.evidenceId ?? b.key ?? "")),
  );
}

export function buildFrameworkReleaseSnapshot(assessment: any): FrameworkReleaseSnapshot {
  const evidence = collectEvidence(assessment);

  return {
    schema: "truvern.frameworkAssessment.release.v1",
    generatedAt: new Date().toISOString(),
    assessment: {
      id: assessment.id,
      title: assessment.title,
      status: assessment.status,
      score: assessment.score,
      maxScore: assessment.maxScore,
      riskLevel: assessment.riskLevel,
      organizationId: assessment.organizationId,
      vendorId: assessment.vendorId,
      assessmentRunId: assessment.assessmentRunId,
      reviewAssignmentId: assessment.reviewAssignmentId,
      submittedAt: assessment.submittedAt,
      readyForReleaseAt: assessment.readyForReleaseAt,
      releasedAt: assessment.releasedAt,
      createdAt: assessment.createdAt,
      updatedAt: assessment.updatedAt,
    },
    framework: assessment.framework
      ? {
          id: assessment.framework.id,
          slug: assessment.framework.slug,
          name: assessment.framework.name,
          version: assessment.framework.version,
          status: assessment.framework.status,
        }
      : null,
    responses: (assessment.responses ?? []).map((response: any) => ({
      id: response.id,
      questionId: response.questionId,
      answer: response.answer,
      score: response.score,
      vendorNotes: response.vendorNotes,
      reviewerNotes: response.reviewerNotes,
      evidence: response.evidence,
      control: response.question?.control
        ? {
            id: response.question.control.id,
            controlId: response.question.control.controlId,
            family: response.question.control.family,
            title: response.question.control.title,
          }
        : null,
      question: response.question
        ? {
            id: response.question.id,
            prompt: response.question.prompt,
            helpText: response.question.helpText,
            weight: response.question.weight,
            requiresEvidence: response.question.requiresEvidence,
            requiresAttestation: response.question.requiresAttestation,
          }
        : null,
    })),
    findings: (assessment.findings ?? []).map((finding: any) => ({
      id: finding.id,
      controlId: finding.controlId,
      severity: finding.severity,
      status: finding.status,
      title: finding.title,
      description: finding.description,
      recommendation: finding.recommendation,
      remediationRequired: finding.remediationRequired,
      attestationRequired: finding.attestationRequired,
      dueAt: finding.dueAt,
      createdAt: finding.createdAt,
      updatedAt: finding.updatedAt,
    })),
    remediation: (assessment.findings ?? []).flatMap((finding: any) =>
      (finding.remediations ?? []).map((request: any) => ({
        id: request.id,
        findingId: request.findingId,
        status: request.status,
        requestText: request.requestText,
        vendorResponse: request.vendorResponse,
        reviewerDecision: request.reviewerDecision,
        dueAt: request.dueAt,
        submittedAt: request.submittedAt,
        resolvedAt: request.resolvedAt,
        createdAt: request.createdAt,
        updatedAt: request.updatedAt,
      })),
    ),
    attestations: (assessment.attestations ?? []).map((attestation: any) => ({
      id: attestation.id,
      title: attestation.title,
      description: attestation.description,
      status: attestation.status,
      requestedBy: attestation.requestedBy,
      submittedBy: attestation.submittedBy,
      evidence: attestation.evidence,
      expiresAt: attestation.expiresAt,
      submittedAt: attestation.submittedAt,
      reviewedAt: attestation.reviewedAt,
      createdAt: attestation.createdAt,
      updatedAt: attestation.updatedAt,
    })),
    evidence,
  };
}


