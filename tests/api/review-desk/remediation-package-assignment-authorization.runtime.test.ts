import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("remediation package assignment authorization", () => {
  const routePath = path.join(
    process.cwd(),
    "app/api/review-desk/remediation-packages/[id]/route.ts",
  );

  const source = fs.readFileSync(routePath, "utf8");

  it("imports canonical review-assignment authority", () => {
    expect(source).toContain(
      "requireReviewAssignmentAccess,",
    );
  });

  it("retains assessment.review capability authority", () => {
    expect(source).toContain(
      '"assessment.review"',
    );
  });

  it("binds both GET and PATCH package access to review assignment authority", () => {
    const matches = source.match(
      /await requireReviewAssignmentAccess\(\s*pkg\.reviewAssignmentId,\s*\);/g,
    );

    expect(matches).toHaveLength(2);
  });

  it("checks package access before assignment authority", () => {
    const getStart =
      source.indexOf("export async function GET");

    const patchStart =
      source.indexOf("export async function PATCH");

    expect(getStart).toBeGreaterThanOrEqual(0);
    expect(patchStart).toBeGreaterThan(getStart);

    const getBody =
      source.slice(getStart, patchStart);

    const patchBody =
      source.slice(patchStart);

    for (const body of [getBody, patchBody]) {
      const packageAccess =
        body.indexOf(
          "if (!canAccessPackage(actor, pkg))",
        );

      const assignmentAccess =
        body.indexOf(
          "await requireReviewAssignmentAccess(",
        );

      expect(packageAccess).toBeGreaterThanOrEqual(0);
      expect(assignmentAccess).toBeGreaterThan(
        packageAccess,
      );
    }
  });

  it("authorizes assignment before GET response or PATCH body processing", () => {
    const getStart =
      source.indexOf("export async function GET");

    const patchStart =
      source.indexOf("export async function PATCH");

    const getBody =
      source.slice(getStart, patchStart);

    const patchBody =
      source.slice(patchStart);

    expect(
      getBody.indexOf(
        "await requireReviewAssignmentAccess(",
      ),
    ).toBeLessThan(
      getBody.indexOf(
        "return NextResponse.json({",
        getBody.indexOf(
          "await requireReviewAssignmentAccess(",
        ),
      ),
    );

    expect(
      patchBody.indexOf(
        "await requireReviewAssignmentAccess(",
      ),
    ).toBeLessThan(
      patchBody.indexOf("const body ="),
    );
  });

  it("retains governance authorization error mapping", () => {
    const matches =
      source.match(
        /governanceAuthErrorResponse\(error\)/g,
      ) ?? [];

    expect(matches.length).toBeGreaterThanOrEqual(2);
  });
});
