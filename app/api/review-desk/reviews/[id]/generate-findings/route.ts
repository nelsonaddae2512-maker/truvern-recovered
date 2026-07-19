import { NextResponse } from "next/server";
import { requireReviewerAccess } from "@/lib/auth/truvern-governance";
import prisma from "@/lib/prisma";
import { runGovernanceIntelligence } from "@/lib/governance/intelligence/governance-intelligence-engine";
import { buildCanonicalGovernanceArtifact } from "@/lib/governance/canonical-governance-artifact";
import type { TruvernScoringInput } from "@/lib/governance/scoring-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = {
  params: Promise<{ id: string }> | { id: string };
};

function asArray(value: any): any[] {
  return Array.isArray(value) ? value : [];
}

function meaningfulNarrative(value: unknown) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) return "";
  if (text.toLowerCase() === "not recorded.") return "";
  if (text.toLowerCase() === "not recorded") return "";
  return text;
}

function synthesizeExecutiveSummary(intelligence: any, vendorName: string) {
  const existing = meaningfulNarrative(intelligence?.executiveSummary);
  if (existing) return existing;

  const findings = Array.isArray(intelligence?.findings) ? intelligence.findings : [];
  const findingCount = findings.length;
  const riskLevel = String(intelligence?.score?.riskLevel || "UNKNOWN").toUpperCase();
  const score = intelligence?.score?.percent ?? intelligence?.score?.score ?? null;

  return `${vendorName || "The vendor"} was assessed through Truvern governance intelligence. The review produced ${findingCount} governance finding${findingCount === 1 ? "" : "s"} with an overall residual risk level of ${riskLevel}${score !== null ? ` and score of ${score}` : ""}. Reviewer validation should focus on evidence completeness, remediation readiness, attestation requirements, and release conditions before final approval.`;
}

function synthesizeFinalAssessment(intelligence: any, vendorName: string) {
  const existing =
    meaningfulNarrative(intelligence?.finalRecommendation) ||
    meaningfulNarrative(intelligence?.recommendation);

  if (existing) return existing;

  const recommendation = String(intelligence?.recommendation || "APPROVE").toUpperCase();
  const riskLevel = String(intelligence?.score?.riskLevel || "UNKNOWN").toUpperCase();
  const followUps = Array.isArray(intelligence?.followUps) ? intelligence.followUps.length : 0;

  return `Final governance assessment for ${vendorName || "this vendor"}: ${recommendation}. Residual risk is ${riskLevel}. ${followUps} release condition${followUps === 1 ? "" : "s"} or follow-up item${followUps === 1 ? "" : "s"} should be reviewed before the governance outcome is finalized.`;
}

function cleanNarrativeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function usefulLine(value: unknown) {
  const text = cleanNarrativeText(value)
    .replace(/^Remediation:\s*/i, "")
    .replace(/^€¢\s*/i, "")
    .replace(/^â€¢\s*/i, "")
    .replace(/^[•\-–—*]\s*/i, "")
    .replace(/^Follow-up:\s*/i, "")
    .replace(/^Condition:\s*/i, "")
    .replace(/^€¢\s*/i, "")
    .replace(/^â€¢\s*/i, "")
    .replace(/^[•\-–—*]\s*/i, "")
    .trim();

  if (!text) return "";
  if (/^not recorded\.?$/i.test(text)) return "";
  if (/^executive summary$/i.test(text)) return "";
  if (/^final assessment$/i.test(text)) return "";
  if (/^submitted questionnaire review$/i.test(text)) return "";
  if (/^assessment id:/i.test(text)) return "";
  if (/^submitted answers reviewed:/i.test(text)) return "";

  return text;
}

function uniqueCleanLines(values: unknown[]) {
  const seen = new Set<string>();
  const rows: string[] = [];

  for (const value of values) {
    const text = usefulLine(value);
    if (!text) continue;

    const key = text.toLowerCase();
    if (seen.has(key)) continue;

    seen.add(key);
    rows.push(text);
  }

  return rows.filter((line) => {
    const lower = line.toLowerCase();
    return (
      !lower.includes("vendor profile and submitted assessment indicate") &&
      !lower.includes("no immediate critical blockers") &&
      !lower.includes("recommended governance outcome") &&
      !lower.includes("decision recommendation:") &&
      !lower.includes("residual risk classification:") &&
      !lower.includes("assessment completion timestamp")
    );
  });
}

function buildStructuredGovernanceNarratives(intelligence: any, vendorName: string) {
  const findings = Array.isArray(intelligence?.findings) ? intelligence.findings : [];
  const rawFollowUps = Array.isArray(intelligence?.followUps) ? intelligence.followUps : [];
  const riskLevel = String(intelligence?.score?.riskLevel || "UNKNOWN").toUpperCase();
  const decision = String(intelligence?.recommendation || "APPROVE").toUpperCase();

  const followUps = [
    "Continue periodic governance monitoring.",
    "Maintain evidence and operational control documentation.",
    "Notify customers of material operational or security changes when applicable.",
  ];

  const executiveSummary =
    cleanNarrativeText(intelligence?.executiveSummary) ||
    `${vendorName || "The vendor"} completed a Truvern governance assessment review for operational, security, and vendor risk evaluation.

Decision: ${decision}
Residual risk assessment: ${riskLevel}

The review identified ${findings.length} governance finding${findings.length === 1 ? "" : "s"} requiring reviewer validation, evidence review, remediation tracking, or governance acceptance before final release.`;

  const finalAssessment =
    cleanNarrativeText(intelligence?.finalRecommendation) ||
    cleanNarrativeText(intelligence?.recommendation) ||
    `This assessment was reviewed through Truvern governance workflows using submitted assessment materials, vendor operational context, evidence documentation, and risk evaluation procedures.

Submitted questionnaire answers reviewed: ${Array.isArray(intelligence?.responses) ? intelligence.responses.length : "available"}.

Based on the available assessment information and governance review process, Truvern determined that the current recommendation and residual risk classification accurately reflect the vendor's present operational and risk posture.

This assessment outcome is prepared for governance release and customer consumption.`;

  return {
    executiveSummary,
    finalAssessment,
    finalRecommendation: finalAssessment,
    followUps,
    conditionsAndFollowUps: followUps,
    boardSummary: executiveSummary,
    customerSummary: finalAssessment,
    governanceDecisionNarrative: `Decision: ${decision}. Residual risk: ${riskLevel}.`,
  };
}

function extractResponses(payload: any): TruvernScoringInput[] {
  const candidates = [
    payload?.answers,
    payload?.responses,
    payload?.vendorAnswers,
    payload?.questionnaireResponses,
    payload?.assessmentResponses,
    payload?.submittedAnswers,
    payload?.items,
  ];

  const raw = candidates.find((value) => Array.isArray(value)) ?? [];

  return asArray(raw).map((item: any, index: number) => {
    const question = item?.question ?? item?.assessmentQuestion ?? item;

    return {
      questionId: item?.questionId ?? question?.id ?? index + 1,
      controlId:
        item?.controlId ??
        item?.controlKey ??
        question?.controlId ??
        question?.controlKey ??
        question?.controlCode ??
        null,
      controlCode:
        item?.controlCode ??
        question?.controlCode ??
        question?.control ??
        null,
      family:
        item?.family ??
        question?.family ??
        question?.category ??
        null,
      prompt:
        item?.prompt ??
        item?.questionText ??
        question?.prompt ??
        question?.text ??
        question?.title ??
        null,
      answer:
        item?.answer ??
        item?.value ??
        item?.response ??
        item?.selectedOption ??
        null,
      score: typeof item?.score === "number" ? item.score : null,
      maxScore: typeof item?.maxScore === "number" ? item.maxScore : null,
      weight:
        typeof item?.weight === "number"
          ? item.weight
          : typeof question?.weight === "number"
            ? question.weight
            : 1,
      requiresEvidence:
        Boolean(item?.requiresEvidence ?? question?.requiresEvidence ?? false),
      requiresAttestation:
        Boolean(item?.requiresAttestation ?? question?.requiresAttestation ?? false),
      evidence:
        item?.evidence ??
        item?.evidenceFiles ??
        item?.uploadedFiles ??
        null,
    };
  });
}

export async function POST(_request: Request, props: Props) {
  try {
    await requireReviewerAccess();
    const resolved = await props.params;
    const assignmentId = Number(resolved.id);

    if (!Number.isFinite(assignmentId) || assignmentId <= 0) {
      return NextResponse.json({ ok: false, error: "Review assignment id required." }, { status: 400 });
    }

    const rows: any[] = await prisma.$queryRawUnsafe(
      `
      select
        ra.id as "assignmentId",
        ra."organizationId",
        ra."vendorId",
        v.name as "vendorName",
        latest.id as "responseId",
        latest.responses as "responses"
      from "ReviewAssignment" ra
      left join "Vendor" v on v.id = ra."vendorId"
      left join lateral (
        select rr.id, rr.responses
        from "ReviewResponse" rr
        where rr."reviewAssignmentId" = ra.id
        order by rr."updatedAt" desc, rr.id desc
        limit 1
      ) latest on true
      where ra.id = $1
      limit 1
      `,
      assignmentId,
    );

    const row = rows[0];

    if (!row) {
      return NextResponse.json({ ok: false, error: "Review assignment not found." }, { status: 404 });
    }

    const responsePayload = row.responses && typeof row.responses === "object" ? row.responses : {};
    const scoringResponses = extractResponses(responsePayload);

    if (scoringResponses.length === 0) {
      return NextResponse.json(
        { ok: false, error: "No questionnaire responses found for intelligence generation." },
        { status: 400 },
      );
    }

    const intelligence = runGovernanceIntelligence({
      assessmentId: assignmentId,
      vendorName: row.vendorName || "Vendor",
      frameworkName: "Truvern Governance Review",
      responses: scoringResponses,
    });

    const synthesizedExecutiveSummary = synthesizeExecutiveSummary(intelligence, row.vendorName || "Vendor");
    const synthesizedFinalAssessment = synthesizeFinalAssessment(intelligence, row.vendorName || "Vendor");
    const structuredNarratives = buildStructuredGovernanceNarratives(
      {
        ...intelligence,
        executiveSummary: synthesizedExecutiveSummary,
        finalRecommendation: synthesizedFinalAssessment,
      },
      row.vendorName || "Vendor",
    );

    const canonicalGovernanceArtifact = buildCanonicalGovernanceArtifact({
      executiveSummary: structuredNarratives.executiveSummary,
      finalAssessment: structuredNarratives.finalAssessment,
      finalRecommendation: structuredNarratives.finalRecommendation,
      decision: intelligence?.recommendation ?? null,
      riskLevel: intelligence?.score?.riskLevel ?? null,
      findings: Array.isArray(intelligence.findings) ? intelligence.findings : [],
      conditionsAndFollowUps: structuredNarratives.conditionsAndFollowUps,
      boardSummary: structuredNarratives.boardSummary,
      customerSummary: structuredNarratives.customerSummary,
    });

    

  const persistedReviewerIntelligence = {
    schema: "truvern.reviewer_intelligence.v1",
    generatedAt: new Date().toISOString(),
    assessmentId: intelligence.assessmentId ?? null,
    vendorName: intelligence.vendorName,
    frameworkName: intelligence.frameworkName,
    score: intelligence.score,
    findings: Array.isArray(intelligence.findings) ? intelligence.findings : [],
    remediationRequired: Boolean(intelligence.remediationRequired),
    attestationRequired: Boolean(intelligence.attestationRequired),
    recommendation: intelligence.recommendation,
    executiveSummary: structuredNarratives.executiveSummary,
    finalAssessment: structuredNarratives.finalAssessment,
    finalRecommendation: structuredNarratives.finalRecommendation,
    followUps: structuredNarratives.followUps,
    conditionsAndFollowUps: structuredNarratives.conditionsAndFollowUps,
    boardSummary: structuredNarratives.boardSummary,
    customerSummary: structuredNarratives.customerSummary,
    governanceDecisionNarrative: structuredNarratives.governanceDecisionNarrative,
    metrics: intelligence.metrics ?? {},
  };

    const mergedResponses = {
      ...responsePayload,
      truvernReviewerIntelligence: persistedReviewerIntelligence,
      executiveSummary: canonicalGovernanceArtifact.executiveSummary,
      finalRecommendation: canonicalGovernanceArtifact.finalRecommendation,
      finalAssessment: canonicalGovernanceArtifact.finalAssessment,
      conditionsAndFollowUps: canonicalGovernanceArtifact.conditionsAndFollowUps,
      boardSummary: structuredNarratives.boardSummary,
      customerSummary: structuredNarratives.customerSummary,
      governanceDecisionNarrative: structuredNarratives.governanceDecisionNarrative,
      canonicalGovernanceArtifact,
      findings: persistedReviewerIntelligence.findings,
    };

    if (row.responseId) {
      await prisma.$executeRawUnsafe(
        `
        update "ReviewResponse"
        set responses = $1::jsonb, "updatedAt" = now()
        where id = $2
        `,
        JSON.stringify(mergedResponses),
        row.responseId,
      );
    }

    await prisma.$executeRawUnsafe(
      `
      update "ReviewAssignment"
      set
        "riskLevel" = $1,
        decision = $2,
        findings = $3,
        "updatedAt" = now()
      where id = $4
      `,
      intelligence.score.riskLevel,
      intelligence.recommendation,
      JSON.stringify(intelligence.findings, null, 2),
      assignmentId,
    );

    return NextResponse.json({
      ok: true,
      assignmentId,
      recommendation: intelligence.recommendation,
      riskLevel: intelligence.score.riskLevel,
      score: intelligence.score.percent,
      findings: intelligence.findings.length,
      followUps: intelligence.followUps.length,
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: String(error?.message || "Failed to generate governance intelligence.") },
      { status: 500 },
    );
  }
}













