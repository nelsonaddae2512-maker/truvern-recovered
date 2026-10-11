import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "app/review-desk/page.tsx"),
  "utf8",
);

describe("PL15D review-list tenant isolation", () => {
  it("requires a verified customer organization actor", () => {
    expect(source).toContain(
      'getCustomerOrganizationActor()',
    );

    expect(source).toContain(
      "customerActor?.organizationId !== org.id",
    );

    expect(source).toContain(
      'redirect("/select-org")',
    );
  });

  it("requires matching assignment, request, and vendor tenants", () => {
    expect(source).toContain(
      'and v."organizationId" = ${organizationId}',
    );

    expect(source).toContain(
      'and rr."organizationId" = v."organizationId"',
    );

    expect(source).toContain(
      'and ra."organizationId" = v."organizationId"',
    );

    expect(source).toContain(
      'and ra."vendorId" = v.id',
    );
  });

  it("requires framework assessments to match the active organization", () => {
    const query = source.match(
      /const frameworkAssessments\s*=\s*await prisma\.truvernFrameworkAssessment\.findMany\(\{\s*where:\s*\{([\s\S]*?)\}\s*,\s*orderBy:/,
    );

    expect(query).not.toBeNull();
    expect(query?.[1]?.trim()).toMatch(/^organizationId,?$/);
    expect(query?.[1]).not.toContain("organizationId: null");
  });
  it("preserves the operator authorization boundary", () => {
    expect(source).toContain(
      "await isTruvernOperator()",
    );

    expect(source).toContain(
      "const customerActor = canManageTruvernReview",
    );

    expect(source).toContain(
      "!canManageTruvernReview && !customerActor",
    );
  });
});