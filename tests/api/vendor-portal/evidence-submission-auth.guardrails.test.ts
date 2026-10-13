import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(
    process.cwd(),
    "app/vendor-portal/evidence-requests/[id]/submit/route.ts",
  ),
  "utf8",
);

describe("Vendor evidence submission authentication guardrails", () => {
  it("does not accept development bypass headers", () => {
    expect(source).not.toContain("x-dev-bypass");
    expect(source).not.toContain("x-dev-email");
  });

  it("requires Clerk authentication", () => {
    expect(source).toContain("await auth()");
    expect(source).toContain("if (!a?.userId) return null");
    expect(source).toContain("await currentUser()");
  });

  it("retains vendor and organization scoping", () => {
    expect(source).toContain("prisma.vendorPortalUser.findFirst");
    expect(source).toContain("organizationId: orgId");
    expect(source).toContain("vendorId: er.vendorId");
  });

  it("retains evidence request status validation", () => {
    expect(source).toContain('er.status !== "OPEN"');
  });
});