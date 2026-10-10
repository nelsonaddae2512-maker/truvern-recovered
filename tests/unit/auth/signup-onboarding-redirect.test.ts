import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("public signup onboarding redirect", () => {
  it("routes successful signup fallback through organization selection", () => {
    const source = readFileSync(
      join(process.cwd(), "app/sign-up/[[...sign-up]]/page.tsx"),
      "utf8",
    );

    expect(source).toContain('fallbackRedirectUrl="/select-org"');
    expect(source).not.toContain('fallbackRedirectUrl="/dashboard"');
  });
});