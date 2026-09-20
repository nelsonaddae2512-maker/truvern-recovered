import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("outcome assignment authorization guardrail", () => {
  it("authorizes the assignment before parsing mutation input", () => {
    const source = fs.readFileSync(
      path.join(
        process.cwd(),
        "app/api/review-desk/reviews/[id]/outcome/route.ts",
      ),
      "utf8",
    );

    const auth = source.indexOf(
      "await requireReviewAssignmentAccess(assignmentId);",
    );
    const body = source.indexOf(
      "const body = await req.json().catch(() => ({}));",
    );
    const read = source.indexOf("await findReviewAssignment({");

    expect(auth).toBeGreaterThan(-1);
    expect(body).toBeGreaterThan(-1);
    expect(read).toBeGreaterThan(-1);
    expect(auth).toBeLessThan(body);
    expect(auth).toBeLessThan(read);
  });
});
