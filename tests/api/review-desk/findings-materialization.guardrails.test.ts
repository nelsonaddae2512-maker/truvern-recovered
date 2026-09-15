import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const root = process.cwd();

function read(relativePath: string) {
  return fs.readFileSync(
    path.join(root, relativePath),
    "utf8",
  );
}

describe("review findings materialization", () => {
  const route = read(
    "app/api/review-desk/reviews/[id]/generate-draft/route.ts",
  );

  const panel = read(
    "components/review-desk/findings-outcome-panel.client.tsx",
  );

  const workspace = read(
    "components/review-desk/review-assignment-workspace.client.tsx",
  );

  test("materializes canonical findings into reviewer intelligence", () => {
    expect(route).toContain(
      "const canonicalFindings =",
    );

    expect(route).toContain(
      "if (canonicalFindings.length === 0)",
    );

    expect(route).toContain(
      "const canonicalRemediationPlans =",
    );

    expect(route).toContain(
      "findings: canonicalFindings",
    );

    expect(route).toContain(
      'source: "CANONICAL_FINDINGS"',
    );

    expect(route).toContain(
      "remediationPlans: canonicalRemediationPlans",
    );

    expect(route).toContain(
      'draftFindingsSource:',
    );

    expect(route).not.toContain(
      "findings: responseDrivenFindingsV2.responseDrivenFindings",
    );

    expect(route).not.toContain(
      "responseDrivenFindingsV2: responseDrivenFindingsV2.responseDrivenFindings",
    );
  });

  test("renders previously stored response-driven findings", () => {
    expect(panel).toContain(
      "safeArray(intelligence.responseDrivenFindingsV2)",
    );

    expect(panel).toContain(
      "safeArray(intelligence.findings).length > 0",
    );
  });

  test("does not publish remediation merely because findings were generated", () => {
    expect(workspace).toContain(
      "Review the findings before publishing remediation requests.",
    );

    expect(workspace).not.toContain(
      'fetch(`/api/review-desk/reviews/${assignment.id}/publish-remediation`',
    );
  });

  test("rejects mojibake in the Review Desk workspace source", () => {
    const workspaceSource = workspace;

    const malformedSequences = [
      String.fromCharCode(0x00c2, 0x00b7),
      String.fromCharCode(0x00e2, 0x0153, 0x201c),
      String.fromCharCode(0x00e2, 0x20ac, 0x00a2),
      String.fromCharCode(0x00e2, 0x20ac, 0x201d),
      String.fromCharCode(0xfffd),
    ];

    const suspiciousLeadCharacters = [
      String.fromCharCode(0x00c2),
      String.fromCharCode(0x00c3),
      String.fromCharCode(0x00e2),
      String.fromCharCode(0xfffd),
    ];

    for (const sequence of malformedSequences) {
      expect(workspaceSource).not.toContain(sequence);
    }

    for (const character of suspiciousLeadCharacters) {
      expect(workspaceSource).not.toContain(character);
    }
  });

  test("keeps finding description independent from remediation workflow fields", () => {
    const source = fs.readFileSync(
      path.join(
        process.cwd(),
        "app/api/review-desk/reviews/[id]/publish-remediation/route.ts",
      ),
      "utf8",
    );

    expect(source).toContain("safeStr(plan?.description),");
    expect(source).not.toContain(
      "safeStr(plan?.recommendation) ? `Recommendation:",
    );

    expect(source).toMatch(
      /const recommendation\s*=\s*safeStr\(finding\.recommendation\)\s*\|\|\s*safeStr\(finding\.remediation\)\s*\|\|\s*safeStr\(finding\.remediationRecommendation\)\s*\|\|\s*safeStr\(finding\.recommendedAction\)\s*\|\|\s*"";/s,
    );

    expect(source).not.toMatch(
      /safeStr\(finding\.recommendedAction\)\s*\|\|\s*description\s*;/s,
    );

    expect(source).toContain("description,");
    expect(source).toContain("recommendation:");
    expect(source).toContain("releaseImpact:");
    expect(source).toContain("evidenceSignal:");
    expect(source).toContain("requiredEvidence:");
    expect(source).toContain("requiredAttestation:");
  });
});
