import {
  describe,
  expect,
  it,
} from "vitest";

import fs from "node:fs";
import path from "node:path";

function readSource(...parts: string[]) {
  return fs.readFileSync(
    path.join(
      process.cwd(),
      ...parts,
    ),
    "utf8",
  );
}

describe("RC40L vendor assessment launch JSON boundary", () => {
  const middleware =
    readSource("middleware.ts");

  const chooser =
    readSource(
      "components",
      "assessment-start-chooser.tsx",
    );

  const route =
    readSource(
      "app",
      "api",
      "vendors",
      "[id]",
      "assessments",
      "route.ts",
    );

  it("keeps vendor APIs out of Clerk browser redirects", () => {
    expect(middleware).toContain(
      '"/api/vendors(.*)"',
    );

    expect(middleware).toContain(
      "if (isApiNoRedirectRoute(req)) return res;",
    );
  });

  it("keeps authentication responses owned by the API route", () => {
    expect(route).toContain(
      'error: "Unauthorized"',
    );

    expect(route).toContain(
      "status: 401",
    );

    expect(route).toContain(
      'error: "Organization required"',
    );

    expect(route).toContain(
      "status: 403",
    );

    expect(route).toContain(
      "return NextResponse.json({",
    );
  });

  it("rejects non-JSON launch responses before parsing them", () => {
    expect(chooser).toContain(
      'res.headers.get("content-type")',
    );

    expect(chooser).toContain(
      'includes("application/json")',
    );

    expect(chooser).toContain(
      "if (!isJson)",
    );

    expect(chooser).toContain(
      "res.redirected",
    );
  });

  it("validates content type before parsing JSON", () => {
    const contentType =
      chooser.indexOf(
        'res.headers.get("content-type")',
      );

    const parse =
      chooser.indexOf(
        "await res.json().catch(() => null)",
      );

    expect(contentType).toBeGreaterThan(-1);
    expect(parse).toBeGreaterThan(-1);
    expect(contentType).toBeLessThan(parse);
  });

  it("preserves successful launch navigation", () => {
    expect(chooser).toContain(
      "if (data.redirectUrl)",
    );

    expect(chooser).toContain(
      "router.push(data.redirectUrl)",
    );

    expect(chooser).toContain(
      "if (data.id)",
    );

    expect(chooser).toContain(
      "router.push(`/assessments/${data.id}/launch`)",
    );
  });
});
