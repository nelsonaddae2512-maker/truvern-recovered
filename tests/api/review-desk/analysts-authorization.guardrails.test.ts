import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  "app/api/review-desk/analysts/route.ts",
  "utf8",
);

describe("review-desk analyst authorization guardrails", () => {
  it("uses actor and member-management authorization instead of the broad reviewer gate", () => {
    expect(source).toContain("getGovernanceActor");
    expect(source).toContain("requireGovernanceCapability");
    expect(source).toContain(
      'requireGovernanceCapability(actor, "member.manage")',
    );
    expect(source).not.toContain("requireReviewerAccess");
  });

  it("preserves the OPS bypass while requiring member.manage for non-OPS actors", () => {
    const opsIndex = source.indexOf(
      'if (actor.role !== "OPS")',
    );
    const capabilityIndex = source.indexOf(
      'requireGovernanceCapability(actor, "member.manage")',
    );

    expect(opsIndex).toBeGreaterThanOrEqual(0);
    expect(capabilityIndex).toBeGreaterThan(opsIndex);
  });

  it("rejects non-OPS cross-organization provisioning before persistence", () => {
    const boundaryIndex = source.indexOf(
      "actor.organizationId !== organizationId",
    );
    const membershipIndex = source.indexOf(
      "const existingMembership = await findFirstOrgMembership",
    );
    const userIndex = source.indexOf(
      "const user = await upsertUser",
    );

    expect(source).toContain("actor.organizationId == null");
    expect(source).toContain("governanceForbidden");
    expect(boundaryIndex).toBeGreaterThanOrEqual(0);
    expect(membershipIndex).toBeGreaterThan(boundaryIndex);
    expect(userIndex).toBeGreaterThan(boundaryIndex);
  });

  it("maps governance authorization errors before the generic server error", () => {
    const authIndex = source.indexOf(
      "const authError = governanceAuthErrorResponse(error);",
    );
    const genericIndex = source.indexOf(
      'console.error("ANALYST_CREATE_ERROR", error)',
    );

    expect(authIndex).toBeGreaterThanOrEqual(0);
    expect(genericIndex).toBeGreaterThan(authIndex);
  });
});
