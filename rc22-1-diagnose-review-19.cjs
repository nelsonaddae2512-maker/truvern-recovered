const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const assignmentId = 19;

function preview(value) {
  if (value === null || value === undefined) return "";
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return text.replace(/\s+/g, " ").trim().slice(0, 220);
}

async function main() {
  const rows = await prisma.$queryRawUnsafe(`
    select
      ra.id as "assignmentId",
      ra.findings as "assignmentFindings",
      ra.decision,
      ra."riskLevel",
      rr.id as "responseId",
      rr.responses
    from "ReviewAssignment" ra
    left join "ReviewResponse" rr on rr."reviewAssignmentId" = ra.id
    where ra.id = $1
    order by rr."updatedAt" desc nulls last
    limit 1
  `, assignmentId);

  const row = rows[0];
  if (!row) throw new Error("Review not found.");

  const responsePayload =
    row.responses && typeof row.responses === "object" ? row.responses : {};

  const structured =
    responsePayload.structuredAssessment &&
    typeof responsePayload.structuredAssessment === "object"
      ? responsePayload.structuredAssessment
      : {};

  const snapshot =
    responsePayload.governanceReleaseSnapshot &&
    typeof responsePayload.governanceReleaseSnapshot === "object"
      ? responsePayload.governanceReleaseSnapshot
      : {};

  const normalized =
    snapshot.normalizedAssessment &&
    typeof snapshot.normalizedAssessment === "object"
      ? snapshot.normalizedAssessment
      : {};

  const intelligence =
    responsePayload.truvernReviewerIntelligence &&
    typeof responsePayload.truvernReviewerIntelligence === "object"
      ? responsePayload.truvernReviewerIntelligence
      : {};

  const diagnostic = [
    ["responsePayload.executiveSummary", responsePayload.executiveSummary],
    ["responsePayload.finalAssessment", responsePayload.finalAssessment],
    ["responsePayload.finalRecommendation", responsePayload.finalRecommendation],

    ["structuredAssessment.executiveSummary", structured.executiveSummary],
    ["structuredAssessment.finalAssessment", structured.finalAssessment],
    ["structuredAssessment.finalRecommendation", structured.finalRecommendation],

    ["governanceReleaseSnapshot.executiveSummary", snapshot.executiveSummary],
    ["governanceReleaseSnapshot.finalAssessment", snapshot.finalAssessment],
    ["governanceReleaseSnapshot.finalRecommendation", snapshot.finalRecommendation],

    ["normalizedAssessment.executiveSummary", normalized.executiveSummary],
    ["normalizedAssessment.finalAssessment", normalized.finalAssessment],
    ["normalizedAssessment.finalRecommendation", normalized.finalRecommendation],

    ["truvernReviewerIntelligence.executiveSummary", intelligence.executiveSummary],
    ["truvernReviewerIntelligence.finalAssessment", intelligence.finalAssessment],
    ["truvernReviewerIntelligence.finalRecommendation", intelligence.finalRecommendation],

    ["responsePayload.conditionsAndFollowUps", responsePayload.conditionsAndFollowUps],
    ["structuredAssessment.conditionsAndFollowUps", structured.conditionsAndFollowUps],
    ["normalizedAssessment.conditions", normalized.conditions],
    ["truvernReviewerIntelligence.followUps", intelligence.followUps],
    ["assignment.findings", row.assignmentFindings],
  ].map(([path, value]) => ({
    path,
    exists:
      value !== null &&
      value !== undefined &&
      (!(typeof value === "string") || value.trim().length > 0) &&
      (!Array.isArray(value) || value.length > 0),
    type: Array.isArray(value) ? "array" : typeof value,
    count: Array.isArray(value) ? value.length : "",
    preview: preview(value),
  }));

  console.table(diagnostic);

  console.log("\nRAW RESPONSE KEYS:");
  console.log(Object.keys(responsePayload).sort());

  console.log("\nSTRUCTURED KEYS:");
  console.log(Object.keys(structured).sort());

  console.log("\nSNAPSHOT KEYS:");
  console.log(Object.keys(snapshot).sort());

  console.log("\nINTELLIGENCE KEYS:");
  console.log(Object.keys(intelligence).sort());
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
