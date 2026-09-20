import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const routePath = path.join(
  process.cwd(),
  "app/api/review-desk/reviews/[id]/evidence-manifest/route.ts",
);

function readRoute() {
  return fs.readFileSync(routePath, "utf8");
}

describe("review evidence-manifest authorization guardrails", () => {
  it("uses assignment-scoped authorization", () => {
    const source = readRoute();

    expect(source).toContain("requireReviewAssignmentAccess");
    expect(source).toContain(
      "await requireReviewAssignmentAccess(reviewId);",
    );
    expect(source).not.toContain("await requireReviewerAccess();");
  });

  it("authorizes before manifest retrieval", () => {
    const source = readRoute();

    const authorization = source.indexOf(
      "await requireReviewAssignmentAccess(reviewId);",
    );
    const retrieval = source.indexOf(
      "await getEvidenceManifestForReview(reviewId)",
    );

    expect(authorization).toBeGreaterThan(-1);
    expect(retrieval).toBeGreaterThan(-1);
    expect(authorization).toBeLessThan(retrieval);
  });

  it("maps governance authorization errors", () => {
    const source = readRoute();

    expect(source).toContain("governanceAuthErrorResponse");
    expect(source).toContain(
      "const authResponse = governanceAuthErrorResponse(error);",
    );
    expect(source).toContain("return authResponse;");
  });

  it("preserves invalid-id rejection before authorization", () => {
    const source = readRoute();

    const validation = source.indexOf(
      "if (!Number.isFinite(reviewId) || reviewId <= 0)",
    );
    const authorization = source.indexOf(
      "await requireReviewAssignmentAccess(reviewId);",
    );

    expect(validation).toBeGreaterThan(-1);
    expect(authorization).toBeGreaterThan(-1);
    expect(validation).toBeLessThan(authorization);
  });

  it("preserves the evidence-manifest artifact contract", () => {
    const source = readRoute();

    expect(source).toContain(
      'artifactType: "truvern_review_evidence_manifest"',
    );
    expect(source).toContain("reviewAssignmentId: reviewId");
    expect(source).toContain(
      '"content-disposition": `attachment; filename="truvern-evidence-manifest-${reviewId}.json"`',
    );
  });
});
