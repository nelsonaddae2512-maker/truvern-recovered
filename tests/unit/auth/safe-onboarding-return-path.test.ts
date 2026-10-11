import { describe, expect, it } from "vitest";
import { safeOnboardingReturnPath } from "@/lib/auth/safe-onboarding-return-path";

describe("safeOnboardingReturnPath", () => {
  it.each([
    "/dashboard",
    "/vendors",
    "/review-desk?view=active",
    "/vendors/25#evidence",
    "/dashboard?tab=overview#top",
  ])("accepts safe internal destination %s", (path) => {
    expect(safeOnboardingReturnPath(path)).toBe(path);
  });

  it.each([
    null,
    undefined,
    "",
    "https://evil.example",
    "javascript:alert(1)",
    "//evil.example",
    "/\\evil.example",
    "/%5Cevil.example",
    "/%2Fevil.example",
    "/%0Aevil.example",
    "/dashboard\nLocation:evil.example",
    "/select-org",
    "/select-org/",
    "/select-org/complete?returnTo=%2Fdashboard",
    "/%73elect-org",
    "/%ZZ",
  ])("rejects unsafe destination %s", (path) => {
    expect(safeOnboardingReturnPath(path)).toBe("/vendors");
  });

  it("does not reject an unrelated route with a similar prefix", () => {
    expect(
      safeOnboardingReturnPath("/select-organization-guide"),
    ).toBe("/select-organization-guide");
  });
});