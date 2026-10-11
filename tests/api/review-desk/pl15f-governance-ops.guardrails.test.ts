import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(
  resolve(process.cwd(), "app/governance-ops/page.tsx"),
  "utf8",
);

describe("PL15F governance-ops operator boundary", () => {
  it("imports the server-side operator authorization guard", () => {
    expect(source).toContain(
      'import { requireTruvernOperator } from "@/lib/truvern-ops-access";',
    );
  });

  it("requires operator authorization at the page entry point", () => {
    expect(source).toMatch(
      /export default async function ReviewDeskPage\([^)]*\)\s*\{\s*await requireTruvernOperator\(\);/,
    );
  });

  it("performs authorization before resolving organization data", () => {
    const guard = source.indexOf("await requireTruvernOperator();");
    const organization = source.indexOf("await requireDbOrganization();");

    expect(guard).toBeGreaterThan(-1);
    expect(organization).toBeGreaterThan(guard);
  });

  it("does not rely on a conditional operator-only UI gate", () => {
    expect(source).toContain("const canManageTruvernReview = true;");
    expect(source).not.toContain(
      "const canManageTruvernReview = await isTruvernOperator();",
    );
  });
});