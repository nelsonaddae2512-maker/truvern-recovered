import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(relativePath: string) {
  return fs.readFileSync(
    path.join(root, relativePath),
    "utf8",
  );
}

const selectClientPath =
  "components/select-org/select-org-client.tsx";

const completeClientPath =
  "components/select-org/select-org-complete.client.tsx";

const selectPagePath =
  "app/select-org/page.tsx";

const completePagePath =
  "app/select-org/complete/page.tsx";

describe("organization bootstrap UI transition", () => {
  it("provides explicit select-org and completion routes", () => {
    expect(
      fs.existsSync(path.join(root, selectPagePath)),
    ).toBe(true);

    expect(
      fs.existsSync(path.join(root, completePagePath)),
    ).toBe(true);

    expect(read(selectPagePath)).toContain(
      "<SelectOrgClient />",
    );

    expect(read(completePagePath)).toContain(
      "<SelectOrgCompleteClient />",
    );
  });

  it("routes Clerk organization selection and creation through the completion boundary", () => {
    const source = read(selectClientPath);

    expect(source).toContain(
      "afterCreateOrganizationUrl={completionUrl}",
    );

    expect(source).toContain(
      "afterSelectOrganizationUrl={completionUrl}",
    );

    expect(source).not.toContain(
      "afterCreateOrganizationUrl={returnTo}",
    );

    expect(source).not.toContain(
      "afterSelectOrganizationUrl={returnTo}",
    );

    expect(source).toContain(
      "`/select-org/complete?returnTo=${encodeURIComponent(returnTo)}`",
    );
  });

  it("continues an already-active Clerk organization through the certified completion boundary", () => {
    const source = read(selectClientPath);

    expect(source).toContain(
      "useOrganization,",
    );

    expect(source).toContain(
      "const { organization, isLoaded: organizationLoaded } = useOrganization();",
    );

    expect(source).toContain(
      "organizationLoaded && organization",
    );

    expect(source).toContain(
      "onClick={() => router.push(completionUrl)}",
    );

    expect(source).toContain(
      "Continue with {activeOrganizationName}",
    );

    expect(source).not.toContain(
      'fetch("/api/access/bootstrap-organization"',
    );
  });
  it("rejects protocol-relative destinations before Clerk navigation", () => {
    const source = read(selectClientPath);

    expect(source).toContain(
      'rawReturnTo.startsWith("/") && !rawReturnTo.startsWith("//")',
    );

    expect(source).toContain(
      ': "/vendors";',
    );
  });

  it("calls only the certified bootstrap endpoint with POST and no request body", () => {
    const source = read(completeClientPath);

    expect(source).toContain(
      '"/api/access/bootstrap-organization"',
    );

    expect(source).toContain(
      'method: "POST"',
    );

    expect(source).not.toContain(
      "body:",
    );
  });

  it("does not send browser-controlled identity authority", () => {
    const source = read(completeClientPath);

    for (const forbidden of [
      "userId:",
      "organizationId:",
      "targetOrganizationId:",
      "clerkUserId:",
      "clerkOrganizationId:",
      "@prisma/client",
      "prisma.",
      "currentUser(",
      "auth(",
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });

  it("rejects unsafe and recursive completion destinations", () => {
    const source = read(completeClientPath);

    expect(source).toContain(
      'candidate.startsWith("/")',
    );

    expect(source).toContain(
      '!candidate.startsWith("//")',
    );

    expect(source).toContain(
      '!candidate.startsWith("/select-org")',
    );

    expect(source).toContain(
      'return "/vendors";',
    );
  });

  it("navigates only after a successful bootstrap response", () => {
    const source = read(completeClientPath);

    const successCheck =
      source.indexOf("body.ok !== true");

    const failure =
      source.indexOf("setError(reason)");

    const navigation =
      source.indexOf("router.replace(returnTo)");

    expect(successCheck).toBeGreaterThan(-1);
    expect(failure).toBeGreaterThan(successCheck);
    expect(navigation).toBeGreaterThan(failure);

    expect(source).toContain(
      "router.replace(returnTo);",
    );

    expect(source).not.toContain(
      "router.refresh()",
    );
  });

  it("fails closed when bootstrap throws", () => {
    const source = read(completeClientPath);

    expect(source).toContain(
      'setError("BOOTSTRAP_FAILED")',
    );

    expect(source).toContain(
      "Organization setup could not be completed.",
    );

    expect(source).toContain(
      'router.replace("/select-org")',
    );
  });

  it("guards the bootstrap effect against duplicate execution for the same mount", () => {
    const source = read(completeClientPath);

    expect(source).toContain(
      "const started = useRef(false);",
    );

    expect(source).toContain(
      "if (started.current)",
    );

    expect(source).toContain(
      "started.current = true;",
    );
  });
});