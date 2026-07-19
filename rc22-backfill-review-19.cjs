const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const assignmentId = 19;

function cleanText(value) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  if (/^not recorded\.?$/i.test(text)) return "";
  return text;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function first(...values) {
  for (const value of values) {
    const text = cleanText(value);
    if (text) return text;
  }
  return "";
}

function cleanCondition(value) {
  const text = cleanText(value)
    .replace(/^Remediation:\s*/i, "")
    .replace(/^Follow-up:\s*/i, "")
    .replace(/^Condition:\s*/i, "")
    .replace(/^€¢\s*/i, "")
    .replace(/^â€¢\s*/i, "")
    .replace(/^[•\-–—*]\s*/i, "")
    .trim();

  const lower = text.toLowerCase();
  if (!text) return "";
  if (lower === "executive summary") return "";
  if (lower === "final assessment") return "";
  if (lower === "conditions & follow-ups") return "";
  if (lower.includes("initial governance observations")) return "";
  if (lower.includes("recommended governance outcome")) return "";
  if (lower.includes("decision recommendation:")) return "";
  if (lower.includes("residual risk classification:")) return "";
  if (lower.includes("assessment completion timestamp")) return "";
  if (lower.includes("vendor profile and submitted assessment indicate")) return "";
  if (lower.includes("no immediate critical blockers")) return "";

  return text;
}

function uniqueConditions(values) {
  const seen = new Set();
  const rows = [];

  for (const value of values) {
    const text = cleanCondition(value);
    if (!text) continue;

    const key = text.toLowerCase();
    if (seen.has(key)) continue;

    seen.add(key);
    rows.push(text);
  }

  return rows;
}

function splitLines(value) {
  return cleanText(value)
    .split(/\r?\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

async function main() {
  const rows = await prisma.$queryRawUnsafe(`
    select
      ra.id as "assignmentId",
      ra.findings,
      ra.decision,
      ra."riskLevel",
      v.name as "vendorName",
      rr.id as "responseId",
      rr.responses
    from "ReviewAssignment" ra
    left join "Vendor" v on v.id = ra."vendorId"
    left join "ReviewResponse" rr on rr."reviewAssignmentId" = ra.id
    where ra.id = $1
    order by rr."updatedAt" desc nulls last
    limit 1
  `, assignmentId);

  const row = rows[0];
  if (!row) throw new Error(`ReviewAssignment ${assignmentId} not found.`);
  if (!row.responseId) throw new Error(`ReviewResponse for assignment ${assignmentId} not found.`);

  const responses = row.responses && typeof row.responses === "object" ? row.responses : {};
  const structured = responses.structuredAssessment && typeof responses.structuredAssessment === "object"
    ? responses.structuredAssessment
    : {};
  const intelligence = responses.truvernReviewerIntelligence && typeof responses.truvernReviewerIntelligence === "object"
    ? responses.truvernReviewerIntelligence
    : {};
  const snapshot = responses.governanceReleaseSnapshot && typeof responses.governanceReleaseSnapshot === "object"
    ? responses.governanceReleaseSnapshot
    : {};
  const normalized = snapshot.normalizedAssessment && typeof snapshot.normalizedAssessment === "object"
    ? snapshot.normalizedAssessment
    : {};

  const vendorName = row.vendorName || intelligence.vendorName || "Vendor";
  const decision = cleanText(row.decision || responses.decision || structured.decision || intelligence.recommendation || "APPROVE").toUpperCase();
  const riskLevel = cleanText(row.riskLevel || responses.riskLevel || intelligence?.score?.riskLevel || "MEDIUM").toUpperCase();

  const executiveSummary = first(
    responses.executiveSummary,
    structured.executiveSummary,
    normalized.executiveSummary,
    snapshot.executiveSummary,
    intelligence.executiveSummary,
    `${vendorName} completed a Truvern governance assessment review.

Decision: ${decision}
Residual risk assessment: ${riskLevel}

The assessment was reviewed for vendor governance, operational risk, evidence posture, and release readiness.`
  );

  const finalAssessment = first(
    responses.finalAssessment,
    responses.finalRecommendation,
    structured.finalAssessment,
    structured.finalRecommendation,
    normalized.finalAssessment,
    snapshot.finalAssessment,
    snapshot.finalRecommendation,
    intelligence.finalAssessment,
    intelligence.finalRecommendation,
    `This assessment was reviewed through Truvern governance workflows using submitted assessment materials, vendor operational context, evidence documentation, and risk evaluation procedures.

Based on the available assessment information and governance review process, Truvern determined that the current recommendation and residual risk classification accurately reflect the vendor's present operational and risk posture.

This assessment outcome is prepared for governance release and customer consumption.`
  );

  const conditions = uniqueConditions([
    ...asArray(responses.conditionsAndFollowUps),
    ...asArray(structured.conditionsAndFollowUps),
    ...asArray(normalized.conditions),
    ...asArray(snapshot.conditionsAndFollowUps),
    ...asArray(intelligence.followUps),
    "Validate evidence completeness and reviewer notes before final release.",
    "Confirm required attestations and exception handling are documented before final approval.",
    "Reconfirm risk classification and governance decision with any new material changes."
  ]);

  const updatedStructured = {
    ...structured,
    executiveSummary,
    finalAssessment,
    finalRecommendation: finalAssessment,
    conditionsAndFollowUps: conditions,
  };

  const updatedIntelligence = {
    ...intelligence,
    executiveSummary,
    finalAssessment,
    finalRecommendation: finalAssessment,
    followUps: conditions,
  };

  const updatedSnapshot = {
    ...snapshot,
    executiveSummary,
    finalAssessment,
    finalRecommendation: finalAssessment,
    normalizedAssessment: {
      ...normalized,
      executiveSummary,
      finalAssessment,
      finalRecommendation: finalAssessment,
      conditions,
    },
    conditionsAndFollowUps: conditions,
    structuredAssessment: updatedStructured,
    truvernReviewerIntelligence: updatedIntelligence,
  };

  const nextResponses = {
    ...responses,
    executiveSummary,
    finalAssessment,
    finalRecommendation: finalAssessment,
    conditionsAndFollowUps: conditions,
    structuredAssessment: updatedStructured,
    truvernReviewerIntelligence: updatedIntelligence,
    governanceReleaseSnapshot: updatedSnapshot,
    rc22Backfill: {
      assignmentId,
      appliedAt: new Date().toISOString(),
      scope: "single-review",
      reason: "Governance narrative backfill and normalization",
    },
  };

  await prisma.$executeRawUnsafe(`
    update "ReviewResponse"
    set responses = $1::jsonb, "updatedAt" = now()
    where id = $2
  `, JSON.stringify(nextResponses), row.responseId);

  await prisma.$executeRawUnsafe(`
    update "ReviewAssignment"
    set findings = $1, decision = $2, "riskLevel" = $3, "updatedAt" = now()
    where id = $4
  `, cleanText(row.findings), decision, riskLevel, assignmentId);

  console.log("RC22 backfill complete:");
  console.table([{
    assignmentId,
    responseId: row.responseId,
    executiveSummary: executiveSummary.slice(0, 80),
    finalAssessment: finalAssessment.slice(0, 80),
    conditions: conditions.length,
    decision,
    riskLevel,
  }]);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
