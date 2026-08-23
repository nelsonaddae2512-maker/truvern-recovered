import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const route = fs.readFileSync(
  path.join(
    root,
    "app/api/review-desk/reviews/[id]/generate-findings/route.ts",
  ),
  "utf8",
);

describe("generate-findings canonical governance persistence", () => {
  it("derives the canonical outcome during intelligence rerun", () => {
    expect(route).toContain(
      "const canonicalOutcome = deriveCanonicalGovernanceOutcome({",
    );
  });

  it("builds the canonical artifact from the canonical outcome", () => {
    expect(route).toContain(
      "decision: canonicalOutcome.recommendation",
    );
    expect(route).toContain(
      "riskLevel: canonicalOutcome.riskLevel",
    );
    expect(route).toContain(
      "conditionsAndFollowUps: canonicalOutcome.followUps",
    );
  });

  it("persists canonical risk and decision to the assignment", () => {
    expect(route).toContain(
      "riskLevel: canonicalOutcome.riskLevel",
    );
    expect(route).toContain(
      "decision: canonicalOutcome.recommendation",
    );
  });

  it("persists canonical reviewer intelligence", () => {
    expect(route).toContain(
      "remediationRequired: canonicalOutcome.remediationRequired",
    );
    expect(route).toContain(
      "attestationRequired: canonicalOutcome.attestationRequired",
    );
    expect(route).toContain(
      "recommendation: canonicalOutcome.recommendation",
    );
    expect(route).toContain(
      "followUps: canonicalOutcome.followUps",
    );
  });

  it("returns canonical risk and recommendation to the client", () => {
    expect(route).toContain(
      "recommendation: canonicalOutcome.recommendation",
    );
    expect(route).toContain(
      "riskLevel: canonicalOutcome.riskLevel",
    );
  });

  it("does not persist raw intelligence risk or decision to ReviewAssignment", () => {
    const transactionStart = route.indexOf(
      "await prisma.$transaction(async (tx) => {",
    );
    const responseStart = route.indexOf(
      "return NextResponse.json({",
      transactionStart,
    );

    expect(transactionStart).toBeGreaterThan(-1);
    expect(responseStart).toBeGreaterThan(transactionStart);

    const transaction = route.slice(
      transactionStart,
      responseStart,
    );

    expect(transaction).not.toContain(
      "riskLevel: intelligence.score.riskLevel",
    );
    expect(transaction).not.toContain(
      "decision: intelligence.recommendation",
    );
  });
});