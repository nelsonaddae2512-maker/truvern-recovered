import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("generate-draft assignment authorization guardrail", () => {
  it("authorizes the assignment before loading review data", () => {
    const source = fs.readFileSync(
      path.join(
        process.cwd(),
        "app/api/review-desk/reviews/[id]/generate-draft/route.ts",
      ),
      "utf8",
    );

    const auth = source.indexOf(
      "await requireReviewAssignmentAccess(assignmentId);",
    );
    const read = source.indexOf("await findReviewAssignment({");

    expect(auth).toBeGreaterThan(-1);
    expect(read).toBeGreaterThan(-1);
    expect(auth).toBeLessThan(read);
  });
});
