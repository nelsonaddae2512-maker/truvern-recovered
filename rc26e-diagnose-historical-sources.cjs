const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function preview(value, max = 500) {
  if (value === null || value === undefined) return "";

  const text =
    typeof value === "string"
      ? value
      : JSON.stringify(value);

  return text.replace(/\s+/g, " ").trim().slice(0, max);
}

function exists(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (isObject(value)) return Object.keys(value).length > 0;
  return true;
}

async function main() {
  const rows = await prisma.$queryRawUnsafe(`
    select
      rr.id as "responseId",
      rr."reviewAssignmentId" as "assignmentId",
      rr.responses,
      rr."createdAt",
      rr."updatedAt",
      ra."assignmentType"::text as "assignmentType",
      ra.status::text as "assignmentStatus",
      ra."vendorId",
      v.name as "vendorName"
    from "ReviewResponse" rr
    left join "ReviewAssignment" ra
      on ra.id = rr."reviewAssignmentId"
    left join "Vendor" v
      on v.id = ra."vendorId"
    where upper(
      coalesce(
        rr.responses->>'releaseState',
        rr.responses->'governanceReleaseSnapshot'->>'releaseState',
        ''
      )
    ) in ('RELEASED', 'CONFIRMED')
    order by rr.id asc
  `);

  for (const row of rows) {
    const responses = isObject(row.responses) ? row.responses : {};
    const structured = isObject(responses.structuredAssessment)
      ? responses.structuredAssessment
      : {};
    const snapshot = isObject(responses.governanceReleaseSnapshot)
      ? responses.governanceReleaseSnapshot
      : {};
    const normalized = isObject(snapshot.normalizedAssessment)
      ? snapshot.normalizedAssessment
      : {};
    const intelligence = isObject(
      responses.truvernReviewerIntelligence ||
      responses.reviewerIntelligence
    )
      ? responses.truvernReviewerIntelligence ||
        responses.reviewerIntelligence
      : {};

    const candidates = [
      ["responses.executiveSummary", responses.executiveSummary],
      ["structured.executiveSummary", structured.executiveSummary],
      ["snapshot.executiveSummary", snapshot.executiveSummary],
      ["snapshot.governanceSummary", snapshot.governanceSummary],
      ["normalized.executiveSummary", normalized.executiveSummary],
      ["intelligence.executiveSummary", intelligence.executiveSummary],

      ["responses.finalAssessment", responses.finalAssessment],
      ["responses.finalRecommendation", responses.finalRecommendation],
      ["structured.finalAssessment", structured.finalAssessment],
      ["structured.finalRecommendation", structured.finalRecommendation],
      ["snapshot.finalAssessment", snapshot.finalAssessment],
      ["snapshot.finalRecommendation", snapshot.finalRecommendation],
      ["normalized.finalAssessment", normalized.finalAssessment],
      ["normalized.finalRecommendation", normalized.finalRecommendation],
      ["intelligence.finalAssessment", intelligence.finalAssessment],
      ["intelligence.finalRecommendation", intelligence.finalRecommendation],
      ["intelligence.recommendation", intelligence.recommendation],

      ["responses.conditionsAndFollowUps", responses.conditionsAndFollowUps],
      ["structured.conditionsAndFollowUps", structured.conditionsAndFollowUps],
      ["snapshot.conditionsAndFollowUps", snapshot.conditionsAndFollowUps],
      ["normalized.conditions", normalized.conditions],
      ["intelligence.followUps", intelligence.followUps],

      ["responses.findings", responses.findings],
      ["responses.questionnaireResponses", responses.questionnaireResponses],
      ["responses.answers", responses.answers],
      ["responses.responses", responses.responses],
      ["structured.questionnaireReview", structured.questionnaireReview],
      ["intelligence.findings", intelligence.findings],
      ["intelligence.metrics", intelligence.metrics],
    ].map(([path, value]) => ({
      path,
      exists: exists(value),
      type: Array.isArray(value) ? "array" : typeof value,
      count: Array.isArray(value) ? value.length : "",
      preview: preview(value),
    }));

    console.log("\n==================================================");
    console.log(
      `Response ${row.responseId} | Assignment ${row.assignmentId} | ${row.vendorName || "Unknown vendor"}`
    );
    console.log("==================================================");

    console.table(candidates);

    console.log("\nROOT RESPONSE KEYS");
    console.log(Object.keys(responses).sort());

    console.log("\nSTRUCTURED KEYS");
    console.log(Object.keys(structured).sort());

    console.log("\nSNAPSHOT KEYS");
    console.log(Object.keys(snapshot).sort());

    console.log("\nINTELLIGENCE KEYS");
    console.log(Object.keys(intelligence).sort());
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
