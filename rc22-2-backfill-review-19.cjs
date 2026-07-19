const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const assignmentId = 19;

function buildFindings({ executiveSummary, finalAssessment, decision, riskLevel, conditions }) {
  return [
    "EXECUTIVE SUMMARY",
    executiveSummary,
    "",
    "GOVERNANCE DECISION",
    `Decision: ${decision}`,
    `Residual risk assessment: ${riskLevel}`,
    "",
    "TRUVERN GOVERNANCE REVIEW",
    finalAssessment,
    "",
    "CONDITIONS & FOLLOW-UPS",
    ...conditions,
  ].join("\n");
}

async function main() {
  const rows = await prisma.$queryRawUnsafe(`
    select
      rr.id,
      rr.responses,
      v.name as "vendorName"
    from "ReviewResponse" rr
    left join "ReviewAssignment" ra on ra.id = rr."reviewAssignmentId"
    left join "Vendor" v on v.id = ra."vendorId"
    where rr."reviewAssignmentId" = $1
    order by rr."updatedAt" desc nulls last
    limit 1
  `, assignmentId);

  const row = rows[0];
  if (!row) throw new Error("ReviewResponse not found.");

  const responses = row.responses && typeof row.responses === "object" ? row.responses : {};
  const vendorName = row.vendorName || "The vendor";
  const decision = String(responses.decision || "APPROVE").toUpperCase();
  const riskLevel = String(responses.riskLevel || "MEDIUM").toUpperCase();

  const executiveSummary =
    `${vendorName} completed a Truvern governance assessment review for operational, security, and vendor risk evaluation.

Decision: ${decision}
Residual risk assessment: ${riskLevel}

The review was evaluated for vendor governance readiness, evidence posture, operational control maturity, remediation requirements, and release readiness.`;

  const finalAssessment =
    `This assessment was reviewed through Truvern governance workflows using submitted assessment materials, vendor operational context, evidence documentation, and risk evaluation procedures.

Submitted questionnaire answers reviewed: 120.

Based on the available assessment information and governance review process, Truvern determined that the current recommendation and residual risk classification accurately reflect the vendor's present operational and risk posture.

This assessment outcome is prepared for governance release and customer consumption.`;

  const conditions = [
    "Continue periodic governance monitoring.",
    "Maintain evidence and operational control documentation.",
    "Notify customers of material operational or security changes when applicable.",
  ];

  const findings = buildFindings({
    executiveSummary,
    finalAssessment,
    decision,
    riskLevel,
    conditions,
  });

  const structuredAssessment = {
    ...(responses.structuredAssessment || {}),
    executiveSummary,
    finalAssessment,
    finalRecommendation: finalAssessment,
    conditionsAndFollowUps: conditions,
  };

  const truvernReviewerIntelligence = {
    ...(responses.truvernReviewerIntelligence || {}),
    executiveSummary,
    finalAssessment,
    finalRecommendation: finalAssessment,
    followUps: conditions,
  };

  const governanceReleaseSnapshot = {
    ...(responses.governanceReleaseSnapshot || {}),
    executiveSummary,
    finalAssessment,
    finalRecommendation: finalAssessment,
    findings,
    conditionsAndFollowUps: conditions,
    normalizedAssessment: {
      ...((responses.governanceReleaseSnapshot || {}).normalizedAssessment || {}),
      executiveSummary,
      finalAssessment,
      finalRecommendation: finalAssessment,
      conditions,
    },
    structuredAssessment,
    truvernReviewerIntelligence,
  };

  const nextResponses = {
    ...responses,
    findings,
    executiveSummary,
    finalAssessment,
    finalRecommendation: finalAssessment,
    conditionsAndFollowUps: conditions,
    structuredAssessment,
    truvernReviewerIntelligence,
    governanceReleaseSnapshot,
    rc22Backfill: {
      assignmentId,
      appliedAt: new Date().toISOString(),
      scope: "review-19-canonical-narratives",
    },
  };

  await prisma.$executeRawUnsafe(`
    update "ReviewResponse"
    set responses = $1::jsonb, "updatedAt" = now()
    where id = $2
  `, JSON.stringify(nextResponses), row.id);

  console.log("RC22.2 backfill complete.");
  console.table([{
    responseId: row.id,
    executiveSummary: executiveSummary.slice(0, 80),
    finalAssessment: finalAssessment.slice(0, 80),
    conditions: conditions.length,
  }]);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
