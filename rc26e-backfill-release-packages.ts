import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";

import {
  buildCanonicalGovernanceArtifact,
  cleanGovernanceConditions,
} from "./lib/governance/canonical-governance-artifact";

import {
  buildGovernanceReleasePackage,
  verifyGovernanceReleasePackage,
  type GovernanceReleasePackage,
} from "./lib/governance/governance-release-package";

const prisma = new PrismaClient();

const APPLY = process.argv.includes("--apply");

type JsonObject = Record<string, any>;

type Row = {
  responseId: number;
  reviewAssignmentId: number | null;
  reviewRequestId: number | null;
  organizationId: number | null;
  responses: JsonObject | null;
  responseCreatedAt: Date;
  responseUpdatedAt: Date;
  responseSubmittedAt: Date | null;
  assignmentType: string | null;
  assignmentStatus: string | null;
  reviewerUserId: string | null;
  reviewerName: string | null;
  assignedReviewerName: string | null;
  assignedTo: string | null;
  vendorId: number | null;
  vendorName: string | null;
  vendorCategory: string | null;
};

function isObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function objectValue(value: unknown): JsonObject {
  return isObject(value) ? value : {};
}

function text(value: unknown): string {
  const result = String(value ?? "").trim();

  if (!result) return "";
  if (/^not recorded\.?$/i.test(result)) return "";

  return result;
}

function firstText(...values: unknown[]): string {
  for (const value of values) {
    const result = text(value);
    if (result) return result;
  }

  return "";
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => text(item))
    .filter(Boolean);
}

function firstArray(...values: unknown[]): string[] {
  for (const value of values) {
    const result = stringArray(value);
    if (result.length > 0) return result;
  }

  return [];
}

function section(
  sourceValue: unknown,
  heading: string,
  followingHeadings: string[],
): string {
  const source = text(sourceValue);
  if (!source) return "";

  const upperSource = source.toUpperCase();
  const upperHeading = heading.toUpperCase();

  const headingIndex = upperSource.indexOf(upperHeading);
  if (headingIndex < 0) return "";

  const start = headingIndex + heading.length;
  let end = source.length;

  for (const following of followingHeadings) {
    const index = upperSource.indexOf(following.toUpperCase(), start);

    if (index >= 0 && index < end) {
      end = index;
    }
  }

  return source
    .slice(start, end)
    .replace(/^[\s:\-–—]+/, "")
    .trim();
}

function lastSection(sourceValue: unknown, heading: string): string {
  const source = text(sourceValue);
  if (!source) return "";

  const upperSource = source.toUpperCase();
  const upperHeading = heading.toUpperCase();

  const headingIndex = upperSource.lastIndexOf(upperHeading);
  if (headingIndex < 0) return "";

  return source
    .slice(headingIndex + heading.length)
    .replace(/^[\s:\-–—]+/, "")
    .trim();
}

function lines(value: unknown): string[] {
  return text(value)
    .split(/\r?\n/)
    .map((line) =>
      line
        .replace(/^Remediation:\s*/i, "")
        .replace(/^Follow-up:\s*/i, "")
        .replace(/^Condition:\s*/i, "")
        .replace(/^[•\-–—*]\s*/, "")
        .trim(),
    )
    .filter(Boolean);
}

function validDate(...values: unknown[]): string | null {
  for (const value of values) {
    if (!value) continue;

    const date = value instanceof Date
      ? value
      : new Date(String(value));

    if (!Number.isNaN(date.getTime())) {
      return date.toISOString();
    }
  }

  return null;
}

function submittedAnswerCount(payload: JsonObject): number | null {
  const candidates = [
    payload.structuredAssessment?.questionnaireReview?.submittedAnswers,
    payload.structuredAssessment?.submittedAnswers,
    payload.truvernReviewerIntelligence?.metrics?.submittedAnswers,
    payload.metrics?.submittedAnswers,
    payload.questionnaireReview?.submittedAnswers,
  ];

  for (const value of candidates) {
    const number = Number(value);

    if (Number.isFinite(number) && number >= 0) {
      return Math.floor(number);
    }
  }

  return null;
}

async function main() {
  const rows = await prisma.$queryRawUnsafe<Row[]>(`
    select
      rr.id as "responseId",
      rr."reviewAssignmentId",
      rr."reviewRequestId",
      rr."organizationId",
      rr.responses,
      rr."createdAt" as "responseCreatedAt",
      rr."updatedAt" as "responseUpdatedAt",
      rr."submittedAt" as "responseSubmittedAt",

      ra."assignmentType"::text as "assignmentType",
      ra.status::text as "assignmentStatus",
      ra."reviewerUserId",
      ra."reviewerName",
      ra."assignedReviewerName",
      ra."assignedTo",
      ra."vendorId",

      v.name as "vendorName",
      v.category as "vendorCategory"

    from "ReviewResponse" rr
    left join "ReviewAssignment" ra
      on ra.id = rr."reviewAssignmentId"
    left join "Vendor" v
      on v.id = ra."vendorId"

    where upper(coalesce(rr.responses->>'releaseState', '')) in (
      'RELEASED',
      'CONFIRMED'
    )
       or upper(
            coalesce(
              rr.responses->'governanceReleaseSnapshot'->>'releaseState',
              ''
            )
          ) in (
            'RELEASED',
            'CONFIRMED'
          )

    order by rr.id asc
  `);

  const backupPath = resolve(
    process.env.RC26E_BACKUP_PATH ||
      "./rc26e-review-response-backup.json",
  );

  await writeFile(
    backupPath,
    JSON.stringify(
      {
        createdAt: new Date().toISOString(),
        applyMode: APPLY,
        recordCount: rows.length,
        records: rows,
      },
      null,
      2,
    ),
    "utf8",
  );

  console.log(`\nBackup written to: ${backupPath}`);
  console.log(`Mode: ${APPLY ? "APPLY" : "DRY RUN"}`);
  console.log(`Confirmed/released responses found: ${rows.length}`);

  const results: Array<Record<string, unknown>> = [];

  for (const row of rows) {
    const responses = objectValue(row.responses);
    const snapshot = objectValue(responses.governanceReleaseSnapshot);
    const normalized = objectValue(snapshot.normalizedAssessment);
    const structured = objectValue(responses.structuredAssessment);
    const intelligence = objectValue(
      responses.truvernReviewerIntelligence ||
        responses.reviewerIntelligence,
    );

    const existingPackage =
      isObject(responses.governanceReleasePackage)
        ? responses.governanceReleasePackage
        : isObject(snapshot.governanceReleasePackage)
          ? snapshot.governanceReleasePackage
          : null;

    if (existingPackage) {
      const packageValid = verifyGovernanceReleasePackage(
        existingPackage as GovernanceReleasePackage,
      );

      if (packageValid) {
        results.push({
          responseId: row.responseId,
          assignmentId: row.reviewAssignmentId,
          vendor: row.vendorName,
          action: "SKIPPED_VALID_PACKAGE",
          packageId: existingPackage.packageId,
        });

        continue;
      }

      throw new Error(
        `Response ${row.responseId} already has an invalid release package. ` +
          "Refusing to overwrite it automatically.",
      );
    }

    const findingsText = text(responses.findings);

    const parsedExecutiveSummary = section(
      findingsText,
      "EXECUTIVE SUMMARY",
      [
        "GOVERNANCE DECISION",
        "FINAL ASSESSMENT",
        "TRUVERN GOVERNANCE REVIEW",
        "CONDITIONS & FOLLOW-UPS",
      ],
    );

    const parsedFinalAssessment = firstText(
      section(
        findingsText,
        "FINAL ASSESSMENT",
        [
          "CONDITIONS & FOLLOW-UPS",
          "FINDINGS",
          "REMEDIATION",
        ],
      ),
      section(
        findingsText,
        "TRUVERN GOVERNANCE REVIEW",
        [
          "CONDITIONS & FOLLOW-UPS",
          "FINDINGS",
          "REMEDIATION",
        ],
      ),
    );

    const recordedDecision = firstText(
      responses.decision,
      snapshot.decision,
      normalized.decision,
      structured.riskAnalysis?.governanceDecision,
      intelligence.recommendation,
    );

    const recordedRiskLevel = firstText(
      responses.riskLevel,
      snapshot.riskLevel,
      normalized.riskLevel,
      normalized.residualRisk,
      structured.riskAnalysis?.residualRisk,
      intelligence.score?.riskLevel,
    );

    const preservedExecutiveSummary = firstText(
      responses.executiveSummary,
      structured.executiveSummary,
      snapshot.executiveSummary,
      normalized.executiveSummary,
      intelligence.executiveSummary,
      parsedExecutiveSummary,
    );

    const executiveSummary =
      preservedExecutiveSummary ||
      [
        `Historical governance release for ${row.vendorName || "the vendor"}.`,
        "The original executive narrative was not preserved in the legacy release record.",
        `Recorded governance decision: ${recordedDecision || "not recorded"}.`,
        `Recorded residual risk: ${recordedRiskLevel || "not recorded"}.`,
        "This migration preserves the historical release metadata, evidence snapshot, acknowledgement, and governance seal without adding new assessment conclusions.",
      ].join(" ");

    const preservedFinalAssessment = firstText(
      responses.finalAssessment,
      responses.finalRecommendation,
      structured.finalAssessment,
      structured.finalRecommendation,
      snapshot.finalAssessment,
      snapshot.finalRecommendation,
      normalized.finalAssessment,
      normalized.finalRecommendation,
      intelligence.finalAssessment,
      intelligence.finalRecommendation,
      intelligence.recommendation,
      parsedFinalAssessment,
    );

    const finalAssessment =
      preservedFinalAssessment ||
      [
        "Historical release migration assessment.",
        "The legacy record does not contain a preserved final-assessment narrative.",
        `The recorded outcome was ${recordedDecision || "not recorded"} with residual risk ${recordedRiskLevel || "not recorded"}.`,
        "No new substantive assessment conclusion was created during migration.",
      ].join(" ");

    const parsedConditions = lines(
      lastSection(findingsText, "CONDITIONS & FOLLOW-UPS"),
    );

    const preservedConditionsAndFollowUps = cleanGovernanceConditions(
      firstArray(
        responses.conditionsAndFollowUps,
        structured.conditionsAndFollowUps,
        snapshot.conditionsAndFollowUps,
        normalized.conditions,
        normalized.conditionsAndFollowUps,
        intelligence.conditionsAndFollowUps,
        intelligence.followUps,
        parsedConditions,
      ),
    );

    const conditionsAndFollowUps =
      preservedConditionsAndFollowUps.length > 0
        ? preservedConditionsAndFollowUps
        : [
            "Legacy release migrated without a preserved conditions or follow-up narrative. Refer to the original evidence snapshot, acknowledgement, and governance seal for the historical record.",
          ];


    const decision = recordedDecision || null;
    const riskLevel = recordedRiskLevel || null;

    const findings = Array.isArray(intelligence.findings)
      ? intelligence.findings
      : Array.isArray(responses.findingsList)
        ? responses.findingsList
        : [];

    const migrationSource =
      preservedExecutiveSummary &&
      preservedFinalAssessment &&
      preservedConditionsAndFollowUps.length > 0
        ? "PRESERVED_LEGACY_NARRATIVE"
        : findingsText || preservedConditionsAndFollowUps.length > 0
          ? "RECONSTRUCTED_FROM_LEGACY_FINDINGS"
          : "METADATA_ONLY_HISTORICAL_SUMMARY";

    const legacyReleaseMigration = {
      schema: "truvern.legacy_release_migration.v1",
      migratedAt: new Date().toISOString(),
      source: migrationSource,
      originalResponseId: row.responseId,
      originalAssignmentId: row.reviewAssignmentId,
      originalReleaseState: firstText(
        responses.releaseState,
        snapshot.releaseState,
      ),
      originalNarrativePreserved: Boolean(
        preservedExecutiveSummary && preservedFinalAssessment,
      ),
      originalConditionsPreserved:
        preservedConditionsAndFollowUps.length > 0,
      substantiveConclusionsAdded: false,
    };

    const canonicalGovernanceArtifact =
      buildCanonicalGovernanceArtifact({
        executiveSummary,
        finalAssessment,
        finalRecommendation: firstText(
          responses.finalRecommendation,
          structured.finalRecommendation,
          intelligence.finalRecommendation,
          finalAssessment,
        ),
        decision,
        riskLevel,
        findings,
        conditionsAndFollowUps,
        boardSummary: firstText(
          responses.boardSummary,
          structured.boardSummary,
          intelligence.boardSummary,
          executiveSummary,
        ),
        customerSummary: firstText(
          responses.customerSummary,
          structured.customerSummary,
          intelligence.customerSummary,
          finalAssessment,
        ),
      });

    const confirmedAt = validDate(
      responses.confirmedAt,
      responses.confirmation?.confirmedAt,
      snapshot.confirmedAt,
      snapshot.releasedAt,
      responses.releasedAt,
      row.responseSubmittedAt,
      row.responseUpdatedAt,
    );

    const releasedAt = validDate(
      responses.releasedAt,
      snapshot.releasedAt,
      confirmedAt,
      row.responseSubmittedAt,
      row.responseUpdatedAt,
    );

    const governanceReleasePackage =
      buildGovernanceReleasePackage({
        canonicalGovernanceArtifact,

        reviewer: {
          userId:
            firstText(
              row.reviewerUserId,
              row.assignedTo,
            ) || null,
          name:
            firstText(
              row.reviewerName,
              row.assignedReviewerName,
            ) || "Truvern Reviewer",
          role: "Governance Reviewer",
        },

        vendor: {
          id: row.vendorId,
          name: row.vendorName || "Vendor",
          category: row.vendorCategory,
          tier: firstText(
            responses.vendorTier,
            snapshot.vendorTier,
          ) || null,
          criticality: firstText(
            responses.vendorCriticality,
            snapshot.vendorCriticality,
          ) || null,
        },

        assessment: {
          assignmentId:
            row.reviewAssignmentId ?? `response-${row.responseId}`,
          requestId: row.reviewRequestId,
          responseId: row.responseId,
          organizationId: row.organizationId,
          frameworkName:
            firstText(
              structured.frameworkName,
              responses.frameworkName,
              snapshot.frameworkName,
            ) || "Truvern Governance Review",
          assessmentType: row.assignmentType,
          submittedAnswers: submittedAnswerCount(responses),
        },

        evidenceSummary: {
          evidenceFiles: Number(
            snapshot.evidenceSummary?.artifactCount ||
              responses.evidenceSummary?.artifactCount ||
              0,
          ),
          pendingRequests: 0,
          completedRequests: 0,
          missingEvidence: firstArray(
            snapshot.evidenceSummary?.missingEvidence,
            responses.evidenceSummary?.missingEvidence,
          ),
          reviewedEvidence: firstArray(
            snapshot.evidenceSummary?.reviewedEvidence,
            responses.evidenceSummary?.reviewedEvidence,
          ),
        },

        releasedAt,
        confirmedAt,
        releaseState: "CONFIRMED",
        immutable: true,
        packageVersion: 1,
      });

    if (!verifyGovernanceReleasePackage(governanceReleasePackage)) {
      throw new Error(
        `Generated package hash verification failed for response ${row.responseId}.`,
      );
    }

    const nextSnapshot = {
      ...snapshot,
      canonicalGovernanceArtifact,
      governanceReleasePackage,
      legacyReleaseMigration,
    };

    const nextResponses = {
      ...responses,

      executiveSummary:
        canonicalGovernanceArtifact.executiveSummary,

      finalAssessment:
        canonicalGovernanceArtifact.finalAssessment,

      finalRecommendation:
        canonicalGovernanceArtifact.finalRecommendation,

      conditionsAndFollowUps:
        canonicalGovernanceArtifact.conditionsAndFollowUps,

      boardSummary:
        canonicalGovernanceArtifact.boardSummary,

      customerSummary:
        canonicalGovernanceArtifact.customerSummary,

      canonicalGovernanceArtifact,
      governanceReleasePackage,
      legacyReleaseMigration,

      governanceReleaseSnapshot: nextSnapshot,
    };

    if (APPLY) {
      await prisma.$executeRawUnsafe(
        `
        update "ReviewResponse"
        set
          responses = $1::jsonb,
          "updatedAt" = now()
        where id = $2
        `,
        JSON.stringify(nextResponses),
        row.responseId,
      );

      const verificationRows = await prisma.$queryRawUnsafe<
        Array<{ responses: JsonObject }>
      >(
        `
        select responses
        from "ReviewResponse"
        where id = $1
        limit 1
        `,
        row.responseId,
      );

      const persisted = objectValue(
        verificationRows[0]?.responses,
      );

      const persistedPackage =
        persisted.governanceReleasePackage;

      if (
        !isObject(persistedPackage) ||
        !verifyGovernanceReleasePackage(
          persistedPackage as GovernanceReleasePackage,
        )
      ) {
        throw new Error(
          `Post-write package verification failed for response ${row.responseId}.`,
        );
      }
    }

    results.push({
      responseId: row.responseId,
      assignmentId: row.reviewAssignmentId,
      vendor: row.vendorName,
      action: APPLY ? "BACKFILLED" : "WOULD_BACKFILL",
      packageId: governanceReleasePackage.packageId,
      packageHashValid: true,
      conditions: conditionsAndFollowUps.length,
      migrationSource,
      originalNarrativePreserved:
        legacyReleaseMigration.originalNarrativePreserved,
    });
  }

  console.log("\nRC26E RESULTS");
  console.table(results);

  const failed = results.filter(
    (result) =>
      result.action !== "BACKFILLED" &&
      result.action !== "WOULD_BACKFILL" &&
      result.action !== "SKIPPED_VALID_PACKAGE",
  );

  if (failed.length > 0) {
    throw new Error(
      `${failed.length} records did not complete successfully.`,
    );
  }

  console.log(
    `\nRC26E_BACKFILL=${APPLY ? "APPLIED" : "DRY_RUN_SUCCESS"}`,
  );
}

main()
  .catch((error) => {
    console.error("\nRC26E FAILED");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
