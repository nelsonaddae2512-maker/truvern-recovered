import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const vendorPage = readFileSync(
  resolve(process.cwd(), "app/(app)/vendors/[id]/page.tsx"),
  "utf8",
);

const reviewPage = readFileSync(
  resolve(process.cwd(), "app/review-desk/[assignmentId]/page.tsx"),
  "utf8",
);

describe("PL14 tenant isolation guardrails", () => {
  it("resolves the customer before retrieving vendor details", () => {
    const actor = vendorPage.indexOf(
      "const actor = await getCustomerOrganizationActor();",
    );
    const vendor = vendorPage.indexOf(
      "const vendor = await prisma.vendor.findFirst({",
    );
    const contacts = vendorPage.indexOf(
      "await readVendorDetailContacts(vendor.id)",
    );

    expect(actor).toBeGreaterThan(-1);
    expect(vendor).toBeGreaterThan(actor);
    expect(contacts).toBeGreaterThan(vendor);
    expect(vendorPage).toContain("if (!actor)");
    expect(vendorPage).toContain(
      "organizationId: actor.organizationId",
    );
    expect(vendorPage).not.toContain(
      "where: { id: vendorId },",
    );
  });

  it("validates assignment, vendor, and request ownership", () => {
    expect(reviewPage).toContain(
      "Number(customerActor?.organizationId) !== Number(vendor.organizationId)",
    );
    expect(reviewPage).toContain(
      "Number(assignment.organizationId) !== Number(vendor.organizationId)",
    );
    expect(reviewPage).toContain(
      "Number(assignment.vendorId) !== Number(vendor.id)",
    );
    expect(reviewPage).toContain(
      "Number(request.organizationId) !== Number(vendor.organizationId)",
    );
    expect(reviewPage).toContain(
      "Number(request.vendorId) !== Number(vendor.id)",
    );
  });

  it("preserves the Truvern operator authorization boundary", () => {
    expect(reviewPage).toContain(
      "const canManageTruvernReview = await isTruvernOperator();",
    );
    expect(reviewPage).toContain("!canManageTruvernReview");
  });
});