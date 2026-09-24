import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("Truvern Review canonical questionnaire guardrails", () => {
  const routePath = path.join(
    process.cwd(),
    "app/api/review-desk/assignments/route.ts",
  );

  const pagePath = path.join(
    process.cwd(),
    "app/(app)/vendors/[id]/managed-review/page.tsx",
  );

  const repositoryPath = path.join(
    process.cwd(),
    "lib/repositories/truvern-review-template-repository.ts",
  );

  const route = fs.readFileSync(routePath, "utf8");
  const page = fs.readFileSync(pagePath, "utf8");
  const repository = fs.readFileSync(repositoryPath, "utf8");

  it("uses the canonical template predicate at the HTTP assignment boundary", () => {
    expect(route).toContain(
      "isTruvernNist80053Template,",
    );

    expect(route).toContain(
      "if (!isTruvernNist80053Template(selectedTemplate))",
    );
  });

  it("rejects a noncanonical template before the empty-template check", () => {
    const canonicalGate = route.indexOf(
      "if (!isTruvernNist80053Template(selectedTemplate))",
    );

    const emptyGate = route.indexOf(
      "if (selectedTemplate.questionCount < 1)",
      canonicalGate,
    );

    expect(canonicalGate).toBeGreaterThan(-1);
    expect(emptyGate).toBeGreaterThan(canonicalGate);
  });

  it("retains the canonical framework authority", () => {
    expect(route).toContain(
      'CANONICAL_TRUVERN_FRAMEWORK_SLUG',
    );

    expect(route).toContain(
      'CANONICAL_TRUVERN_FRAMEWORK_VERSION',
    );

    expect(route).toContain(
      'CANONICAL_TRUVERN_FRAMEWORK_QUESTION_COUNT',
    );
  });

  it("limits managed-review template choices to the canonical questionnaire", () => {
    expect(page).toContain(
      '.filter(',
    );

    expect(page).toContain(
      '"Truvern NIST 800-53 Governance Review"',
    );

    expect(page).toContain(
      '.map((template) => ({',
    );
  });

  it("does not globally narrow the shared template repository", () => {
    expect(repository).not.toContain(
      "isTruvernNist80053Template",
    );

    expect(repository).toContain(
      "readTruvernReviewTemplateSelection",
    );
  });
});