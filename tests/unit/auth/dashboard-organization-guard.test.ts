import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("dashboard organization onboarding guard", () => {
  const root = process.cwd();

  const layout = readFileSync(
    join(root, "app/dashboard/layout.tsx"),
    "utf8",
  );

  const guard = readFileSync(
    join(root, "lib/auth/dashboard-organization-guard.ts"),
    "utf8",
  );

  const signIn = readFileSync(
    join(root, "app/sign-in/[[...sign-in]]/page.tsx"),
    "utf8",
  );

  it("enforces the organization guard after deployment access", () => {
    expect(layout).toContain(
      "await requireDeploymentAccess();",
    );

    expect(layout).toContain(
      "await requireDashboardOrganizationAccess();",
    );
  });

  it("requires a selected Clerk organization", () => {
    expect(guard).toContain("if (!session.orgId)");
    expect(guard).toContain("redirect(ONBOARDING_URL)");
  });

  it("checks exact database organization membership", () => {
    expect(guard).toContain(
      "clerkOrgId: session.orgId",
    );

    expect(guard).toContain(
      "organizationId: organization.id",
    );
  });

  it("does not provision membership during dashboard authorization", () => {
    expect(guard).not.toContain(
      "provisionCurrentOrganization",
    );

    expect(guard).not.toContain(
      "getGovernanceActor",
    );
  });

  it("preserves operator access", () => {
    expect(guard).toContain(
      "truvernAccess.isTruvernOperator",
    );
  });

  it("routes default sign-in through onboarding", () => {
    expect(signIn).toContain(
      '"/select-org?returnTo=%2Fdashboard"',
    );
  });
});