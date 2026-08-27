import { scoreAssessment, type TruvernAssessmentScore, type TruvernScoringInput } from "./scoring-engine";

export type TruvernGeneratedFinding = {
  controlKey: string;
  controlCode: string | null;
  family: string | null;
  severity: "INFO" | "LOW" | "MODERATE" | "HIGH" | "CRITICAL";
  title: string;
  description: string;
  recommendation: string;
  remediationRequired: boolean;
  attestationRequired: boolean;
  evidenceRequired: boolean;
  dueInDays: number;
  metadata: Record<string, unknown>;
};

export type TruvernFindingsResult = {
  score: TruvernAssessmentScore;
  findings: TruvernGeneratedFinding[];
  remediationRequired: boolean;
  attestationRequired: boolean;
};

function severityFromControlPercent(percent: number): TruvernGeneratedFinding["severity"] {
  if (percent < 35) return "CRITICAL";
  if (percent < 55) return "HIGH";
  if (percent < 75) return "MODERATE";
  if (percent < 90) return "LOW";
  return "INFO";
}

function dueDaysForSeverity(severity: TruvernGeneratedFinding["severity"]): number {
  if (severity === "CRITICAL") return 7;
  if (severity === "HIGH") return 14;
  if (severity === "MODERATE") return 30;
  if (severity === "LOW") return 60;
  return 90;
}

function labelControl(controlCode: string | null, family: string | null, fallback: string): string {
  const parts = [controlCode, family].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : fallback;
}

function semanticHasEvidence(
  value: unknown,
): boolean {
  if (
    value === null ||
    value === undefined
  ) {
    return false;
  }

  if (
    typeof value === "string"
  ) {
    return value.trim().length > 0;
  }

  if (
    Array.isArray(value)
  ) {
    return value.length > 0;
  }

  if (
    typeof value === "object"
  ) {
    return Object.keys(
      value as Record<
        string,
        unknown
      >,
    ).length > 0;
  }

  return true;
}

function semanticUnique(
  values: string[],
): string[] {
  return Array.from(
    new Set(
      values.filter(
        (value) =>
          value.trim().length > 0,
      ),
    ),
  );
}

function semanticContext(
  items: TruvernScoringInput[],
  controlKey: string,
) {
  const rows =
    items.filter(
      (item) =>
        String(
          item.controlId ??
          item.controlCode ??
          "unmapped",
        ) === controlKey,
    );

  const objectives =
    semanticUnique(
      rows.flatMap(
        (item) =>
          item
            .assessmentObjectiveIds ??
          [],
      ),
    );

  const methods =
    semanticUnique(
      rows.flatMap(
        (item) =>
          item.methodTypes ??
          [],
      ),
    );

  const parameterIds =
    semanticUnique(
      rows.flatMap(
        (item) =>
          item.parameterIds ??
          [],
      ),
    );

  const objectIds =
    semanticUnique(
      rows.flatMap(
        (item) =>
          item
            .assessmentObjectIds ??
          [],
      ),
    );

  const rawEnhancements =
    rows.flatMap(
      (item) =>
        item
          .conditionalEnhancements ??
        [],
    );

  const enhancements =
    Array.from(
      new Map(
        rawEnhancements.map(
          (
            enhancement,
            index,
          ) => [
            enhancement
              .controlId ??
            `enhancement-${index}`,
            enhancement,
          ],
        ),
      ).values(),
    );

  const evidencePresent =
    rows.some(
      (item) =>
        semanticHasEvidence(
          item.evidence,
        ),
    );

  const recommendedEvidence =
    rows.some(
      (item) =>
        item
          .recommendedEvidence ===
        true,
    );

  return {
    objectives,
    methods,
    parameterIds,
    objectIds,
    enhancements,
    evidencePresent,
    recommendedEvidence,
  };
}

export function generateFindings(items: TruvernScoringInput[]): TruvernFindingsResult {
  const score = scoreAssessment(items);
  const findings: TruvernGeneratedFinding[] = [];

  for (const control of score.controls) {
    // An unanswered control is incomplete, not noncompliant.
    // Findings are generated only after at least one response
    // for the control has been substantively answered.
    if (control.answeredQuestions === 0) {
      continue;
    }

    const severity = severityFromControlPercent(control.percent);
    const label = labelControl(control.controlCode, control.family, control.controlKey);


    const semantic =
      semanticContext(
        items,
        control.controlKey,
      );

    const controlGap =
      control.percent < 90;

    const semanticEvidenceGap =
      controlGap &&
      semantic.recommendedEvidence &&
      semantic.methods.includes(
        "EXAMINE",
      ) &&
      !semantic.evidencePresent;

    const semanticEnhancements =
      controlGap
        ? semantic.enhancements
            .filter(
              (enhancement) =>
                enhancement
                  .conditionalVendorFollowUp ===
                  true ||
                enhancement
                  .followUpTrigger ===
                  "REVIEWER_OR_INTELLIGENCE_DETERMINED",
            )
        : [];

    if (control.percent < 90) {
      findings.push({
        controlKey: control.controlKey,
        controlCode: control.controlCode,
        family: control.family,
        severity,
        title: `${label} control gap detected`,
        description: `This control scored ${control.percent}% based on ${control.answeredQuestions}/${control.totalQuestions} answered questions.`,
        recommendation:
          severity === "CRITICAL" || severity === "HIGH"
            ? "Request remediation evidence from the vendor and require reviewer validation before release."
            : "Request clarification or compensating evidence before final governance release.",
        remediationRequired: severity === "CRITICAL" || severity === "HIGH" || severity === "MODERATE",
        attestationRequired: control.requiresAttestation || severity === "CRITICAL",
        evidenceRequired: control.missingEvidence > 0,
        dueInDays: dueDaysForSeverity(severity),
        metadata: {
          controlPercent:
            control.percent,

          controlScore:
            control.score,

          controlMaxScore:
            control.maxScore,

          answeredQuestions:
            control.answeredQuestions,

          totalQuestions:
            control.totalQuestions,

          missingEvidence:
            control.missingEvidence,

          semanticVersion:
            "TRV-OSCAL-SEMANTIC-FINDINGS-1.0",

          assessmentObjectiveIds:
            semantic.objectives,

          assessmentMethodTypes:
            semantic.methods,

          parameterIds:
            semantic.parameterIds,

          assessmentObjectIds:
            semantic.objectIds,

          enhancementFollowUpCount:
            semanticEnhancements.length,

          conditionalEnhancementFollowUps:
            semanticEnhancements.map(
              (enhancement) => ({
                controlId:
                  enhancement
                    .controlId ??
                  null,

                title:
                  enhancement
                    .title ??
                  null,

                objectiveIds:
                  enhancement
                    .objectiveIds ??
                  [],

                methodTypes:
                  enhancement
                    .methodTypes ??
                  [],

                evidenceTrigger:
                  enhancement
                    .evidenceTrigger ??
                  null,

                remediationTrigger:
                  enhancement
                    .remediationTrigger ??
                  null,

                attestationTrigger:
                  enhancement
                    .attestationTrigger ??
                  null,

                status:
                  "REVIEW_REQUIRED",
              }),
            ),

          semanticEvidenceGap,
        },
      });
    }

    if (

      controlGap &&

      (

        semantic.objectives.length > 0 ||

        semanticEnhancements.length > 0

      )

    ) {

      findings.push({

        controlKey:

          control.controlKey,

    

        controlCode:

          control.controlCode,

    

        family:

          control.family,

    

        severity:

          control.percent < 55

            ? "HIGH"

            : "MODERATE",

    

        title:

          `${label} semantic verification required`,

    

        description:

          semanticEnhancements.length > 0

            ? `The parent control response indicates a gap. Truvern identified ${semanticEnhancements.length} conditional enhancement obligation(s) and ${semantic.objectives.length} assessment objective(s) requiring reviewer verification.`

            : `The parent control response indicates a gap and ${semantic.objectives.length} NIST assessment objective(s) require reviewer verification.`,

    

        recommendation:

          semantic.methods.includes(

            "EXAMINE",

          )

            ? "Review the applicable assessment objectives, request supporting evidence where needed, and determine which conditional enhancements require vendor follow-up."

            : "Review the applicable assessment objectives and determine which conditional enhancements require vendor follow-up.",

    

        remediationRequired:

          control.percent < 75,

    

        attestationRequired:

          false,

    

        evidenceRequired:

          semanticEvidenceGap,

    

        dueInDays:

          control.percent < 55

            ? 14

            : 30,

    

        metadata: {

          semanticVersion:

            "TRV-OSCAL-SEMANTIC-FINDINGS-1.0",

    

          findingType:

            "OSCAL_SEMANTIC_VERIFICATION",

    

          assessmentObjectiveIds:

            semantic.objectives,

    

          assessmentMethodTypes:

            semantic.methods,

    

          parameterIds:

            semantic.parameterIds,

    

          assessmentObjectIds:

            semantic.objectIds,

    

          evidenceRecommended:

            semantic.recommendedEvidence,

    

          evidencePresent:

            semantic.evidencePresent,

    

          semanticEvidenceGap,

    

          conditionalEnhancements:

            semanticEnhancements.map(

              (enhancement) => ({

                controlId:

                  enhancement

                    .controlId ??

                  null,

    

                title:

                  enhancement

                    .title ??

                  null,

    

                statementText:

                  enhancement

                    .statementText ??

                  null,

    

                objectiveIds:

                  enhancement

                    .objectiveIds ??

                  [],

    

                methodIds:

                  enhancement

                    .methodIds ??

                  [],

    

                methodTypes:

                  enhancement

                    .methodTypes ??

                  [],

    

                disposition:

                  "REVIEW_REQUIRED",

              }),

            ),

        },

      });

    }


    if (

      control.missingEvidence > 0 ||

      semanticEvidenceGap

    ) {
      findings.push({
        controlKey: control.controlKey,
        controlCode: control.controlCode,
        family: control.family,
        severity: control.percent < 75 ? "HIGH" : "MODERATE",
        title: `${label} evidence missing`,
        description:
          control.missingEvidence > 0
            ? `${control.missingEvidence} required evidence item(s) are missing for this control.`
            : "Supporting evidence is recommended by the canonical NIST assessment methods and is required to verify the identified control gap.",
        recommendation:
          "Request supporting documentation, certification, screenshot, policy, report, or signed attestation from the vendor.",
        remediationRequired: true,
        attestationRequired: control.requiresAttestation,
        evidenceRequired: true,
        dueInDays: control.percent < 75 ? 14 : 30,
        metadata: {
          missingEvidence: control.missingEvidence,
          controlPercent: control.percent,
        },
      });
    }

    if (control.requiresAttestation && control.percent < 100) {
      findings.push({
        controlKey: control.controlKey,
        controlCode: control.controlCode,
        family: control.family,
        severity: control.percent < 75 ? "HIGH" : "MODERATE",
        title: `${label} attestation required`,
        description:
          "This control requires a vendor attestation because the response is incomplete, high-impact, or requires formal certification.",
        recommendation:
          "Send an attestation request to the vendor and require reviewer acceptance before final release.",
        remediationRequired: control.percent < 75,
        attestationRequired: true,
        evidenceRequired: false,
        dueInDays: control.percent < 75 ? 14 : 30,
        metadata: {
          controlPercent: control.percent,
          requiresAttestation: true,
        },
      });
    }
  }

  const deduped = new Map<string, TruvernGeneratedFinding>();

  for (const finding of findings) {
    const key = [
      finding.controlKey,
      finding.title,
      finding.severity,
      finding.evidenceRequired,
      finding.attestationRequired,
    ].join(":");

    if (!deduped.has(key)) {
      deduped.set(key, finding);
    }
  }

  const finalFindings = Array.from(deduped.values());

  return {
    score,
    findings: finalFindings,
    remediationRequired: finalFindings.some((finding) => finding.remediationRequired),
    attestationRequired: finalFindings.some((finding) => finding.attestationRequired),
  };
}

export function shouldRequestRemediation(result: TruvernFindingsResult): boolean {
  return result.remediationRequired || result.score.riskLevel === "HIGH" || result.score.riskLevel === "CRITICAL";
}

export function shouldRequestAttestation(result: TruvernFindingsResult): boolean {
  return result.attestationRequired || result.findings.some((finding) => finding.severity === "CRITICAL");
}


