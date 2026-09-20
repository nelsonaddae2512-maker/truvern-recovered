import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const routePath = path.join(
  process.cwd(),
  "app/api/review-desk/reviews/[id]/claim/route.ts",
);

const source = fs.readFileSync(routePath, "utf8");

describe("review claim authorization guardrails", () => {
  it("uses the canonical reviewer actor boundary", () => {
    expect(source).toContain("requireReviewerAccess");
    expect(source).toContain(
      "const actor = await requireReviewerAccess();",
    );
  });

  it("loads and enforces the assignment organization boundary", () => {
    expect(source).toContain(
      "organizationId: number;",
    );
    expect(source).toContain(
      '"organizationId",',
    );
    expect(source).toContain(
      "actor.organizationId !== assignment.organizationId",
    );
    expect(source).toContain(
      'actor.role !== "OPS"',
    );
  });

  it("preserves the Truvern operator boundary", () => {
    expect(source).toContain("isTruvernOperator");
    expect(source).toContain(
      "Only authorized Truvern operators can claim Truvern reviews.",
    );
  });

  it("claims atomically without overwriting another reviewer", () => {
    expect(source).toContain(
      '"reviewerUserId" is null',
    );
    expect(source).toContain(
      'or "reviewerUserId" = ${userId}',
    );
    expect(source).toContain(
      "if (claimed !== 1)",
    );
  });

  it("derives persisted reviewer identity from authenticated server state", () => {
    expect(source).toContain(
      'const { userId } = await auth();',
    );
    expect(source).toContain(
      "const user = await currentUser();",
    );
    expect(source).toContain(
      '"reviewerUserId" = ${userId}',
    );
  });
});
