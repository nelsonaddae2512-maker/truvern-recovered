import { readFileSync } from "node:fs";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

const authPath = path.join(
  root,
  "lib",
  "auth",
  "truvern-governance.ts",
);

const schemaPath = path.join(
  root,
  "prisma",
  "schema.prisma",
);

const authSource = fs.readFileSync(authPath, "utf8");
const schemaSource = fs.readFileSync(schemaPath, "utf8");

describe("R56 organization authorization core", () => {
  it("preserves the existing organization roles", () => {
    for (const role of [
      "OWNER",
      "ADMIN",
      "ANALYST",
      "VIEWER",
      "VENDOR",
    ]) {
      expect(schemaSource).toContain(role);
    }
  });

  it("does not collapse customer roles into REVIEWER", () => {
    expect(authSource).toContain(
      'normalizedRole === "OWNER"',
    );
    expect(authSource).toContain(
      'normalizedRole === "ADMIN"',
    );
    expect(authSource).toContain(
      'normalizedRole === "ANALYST"',
    );
    expect(authSource).toContain(
      'normalizedRole === "VIEWER"',
    );

    expect(authSource).not.toContain(
      '? "REVIEWER"\n        : "UNKNOWN"',
    );
  });

  it("keeps Truvern reviewer identity distinct", () => {
    expect(authSource).toContain(
      '"TRUVERN_REVIEWER"',
    );
  });

  it("does not grant viewer reviewer-work access", () => {
    const start = authSource.indexOf(
      "export async function requireReviewerAccess()",
    );

    const end = authSource.indexOf(
      "export async function requireFrameworkAssessmentAccess",
      start,
    );

    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);

    const gate = authSource.slice(start, end);

    expect(gate).toContain('"ANALYST"');
    expect(gate).toContain('"ADMIN"');
    expect(gate).toContain('"OWNER"');
    expect(gate).not.toContain('"VIEWER"');
  });

  it("allows viewer read access within its own organization", () => {
    const start = authSource.indexOf(
      "export async function requireFrameworkAssessmentAccess",
    );

    const end = authSource.indexOf(
      "export async function requireVendorAssessmentAccess",
      start,
    );

    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);

    const gate = authSource.slice(start, end);

    expect(gate).toContain('"VIEWER"');
    expect(gate).toContain(
      "actor.organizationId === assessment.organizationId",
    );
  });

  it("keeps vendor access bound to organization and vendor", () => {
    expect(authSource).toContain(
      "actor.organizationId === assessment.organizationId",
    );

    expect(authSource).toContain(
      "actor.vendorId === assessment.vendorId",
    );
  });

  it("defines the R56 governance capability vocabulary", () => {
    for (const capability of [
      "governance.read",
      "assessment.manage",
      "assessment.review",
      "finding.manage",
      "governance.approve",
      "report.release",
      "member.manage",
      "billing.manage",
    ]) {
      expect(authSource).toContain(
        `"${capability}"`,
      );
    }
  });

  function capabilityRoleBlock(role: string) {
    const mapMatch = authSource.match(
      /^const GOVERNANCE_CAPABILITIES_BY_ROLE = \{\r?\n([\s\S]*?)^\} satisfies Record</m,
    );

    expect(mapMatch).not.toBeNull();

    const capabilityMap = mapMatch?.[1] ?? "";

    const escapedRole = role.replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&",
    );

    const rolePattern = new RegExp(
      `^  ${escapedRole}: \\[\\r?\\n([\\s\\S]*?)^  \\],`,
      "m",
    );

    const roleMatch =
      capabilityMap.match(rolePattern);

    expect(roleMatch).not.toBeNull();

    return roleMatch?.[1] ?? "";
  }

  it("keeps VIEWER read-only", () => {
    const block =
      capabilityRoleBlock("VIEWER");

    expect(block).toContain(
      '"governance.read"',
    );

    expect(block).not.toContain(
      '"assessment.manage"',
    );

    expect(block).not.toContain(
      '"assessment.review"',
    );

    expect(block).not.toContain(
      '"finding.manage"',
    );

    expect(block).not.toContain(
      '"governance.approve"',
    );

    expect(block).not.toContain(
      '"report.release"',
    );

    expect(block).not.toContain(
      '"member.manage"',
    );

    expect(block).not.toContain(
      '"billing.manage"',
    );
  });

  it("keeps ANALYST out of approval and administration", () => {
    const block =
      capabilityRoleBlock("ANALYST");

    expect(block).toContain(
      '"assessment.manage"',
    );

    expect(block).toContain(
      '"assessment.review"',
    );

    expect(block).toContain(
      '"finding.manage"',
    );

    expect(block).not.toContain(
      '"governance.approve"',
    );

    expect(block).not.toContain(
      '"report.release"',
    );

    expect(block).not.toContain(
      '"member.manage"',
    );

    expect(block).not.toContain(
      '"billing.manage"',
    );
  });

  it("keeps Truvern reviewer out of customer approval", () => {
    const block =
      capabilityRoleBlock(
        "TRUVERN_REVIEWER",
      );

    expect(block).toContain(
      '"governance.read"',
    );

    expect(block).toContain(
      '"assessment.review"',
    );

    expect(block).toContain(
      '"finding.manage"',
    );

    expect(block).not.toContain(
      '"assessment.manage"',
    );

    expect(block).not.toContain(
      '"governance.approve"',
    );

    expect(block).not.toContain(
      '"report.release"',
    );

    expect(block).not.toContain(
      '"member.manage"',
    );

    expect(block).not.toContain(
      '"billing.manage"',
    );
  });

  it("reserves billing management for OWNER", () => {
    const ownerBlock =
      capabilityRoleBlock("OWNER");

    const adminBlock =
      capabilityRoleBlock("ADMIN");

    expect(ownerBlock).toContain(
      '"billing.manage"',
    );

    expect(adminBlock).not.toContain(
      '"billing.manage"',
    );
  });

  it("defines reusable capability enforcement", () => {
    expect(authSource).toContain(
      "export function hasGovernanceCapability(",
    );

    expect(authSource).toContain(
      "export function requireGovernanceCapability(",
    );

    expect(authSource).toContain(
      "Governance capability required:",
    );
  });
  it("keeps Ops access distinct", () => {
    expect(authSource).toContain(
      'if (actor.role !== "OPS")',
    );
  });

  it("enforces assessment.review on remediation package routes", () => {
    const packageRoute = readFileSync(
      "app/api/review-desk/remediation-packages/[id]/route.ts",
      "utf8",
    );
    const commentsRoute = readFileSync(
      "app/api/review-desk/remediation-packages/[id]/comments/route.ts",
      "utf8",
    );

    for (const source of [packageRoute, commentsRoute]) {
      expect(source).toContain("requireGovernanceCapability");
      expect(source).toContain('"assessment.review"');
      expect(source).toContain(
        "actor.organizationId === pkg.organizationId",
      );
      expect(source).toContain(
        'actor.role === "TRUVERN_REVIEWER"',
      );
    }
  });
  it("enforces final approval and release capabilities on mutation routes", () => {
    const packageApprove = readFileSync(
      "app/api/review-desk/remediation-packages/[id]/approve/route.ts",
      "utf8",
    );

    const queueRelease = readFileSync(
      "app/api/review-desk/workflow-queue/[id]/release/route.ts",
      "utf8",
    );

    const frameworkConfirmRelease = readFileSync(
      "app/api/truvern/framework-assessments/[id]/confirm-release/route.ts",
      "utf8",
    );

    const frameworkReleaseReady = readFileSync(
      "app/api/truvern/framework-assessments/[id]/release-ready/route.ts",
      "utf8",
    );

    expect(packageApprove).toMatch(
      /requireGovernanceCapability\s*\(\s*actor\s*,\s*"governance\.approve"\s*,?\s*\)/,
    );

    expect(queueRelease).toContain(
      '"assessment.review"',
    );

    expect(frameworkConfirmRelease).toContain(
      '"report.release"',
    );

    expect(frameworkConfirmRelease).toContain(
      "requireFrameworkAssessmentAccess(assessmentId)",
    );

    expect(frameworkReleaseReady).toContain(
      '"assessment.review"',
    );

    expect(frameworkReleaseReady).toContain(
      "requireFrameworkAssessmentAccess(assessmentId)",
    );
  });

  it("enforces report.release and tenant boundaries on review release routes", () => {
    const confirmRelease = readFileSync(
      "app/api/review-desk/reviews/[id]/confirm-release/route.ts",
      "utf8",
    );

    const bulkRelease = readFileSync(
      "app/api/review-desk/reviews/bulk-release/route.ts",
      "utf8",
    );

    expect(confirmRelease).toContain(
      'requireGovernanceCapability(actor, "report.release")',
    );

    expect(confirmRelease).toContain(
      'actor.role !== "OPS"',
    );

    expect(confirmRelease).toContain(
      "actor.organizationId !== assignment.organizationId",
    );

    expect(bulkRelease).toContain(
      'requireGovernanceCapability(actor, "report.release")',
    );

    expect(bulkRelease).toContain(
      '${actor.role === "OPS"}',
    );

    expect(bulkRelease).toContain(
      'ra."organizationId" = ${actor.organizationId ?? -1}',
    );
  });
});
