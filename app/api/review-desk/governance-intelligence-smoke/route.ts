import { NextResponse } from "next/server";
import { requireOpsAccess } from "@/lib/auth/truvern-governance";
import { runGovernanceIntelligence } from "@/lib/governance/intelligence/governance-intelligence-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { ok: false, error: "Smoke endpoint is disabled in production." },
      { status: 404, headers: { "cache-control": "no-store" } },
    );
  }

  await requireOpsAccess();

  const result = runGovernanceIntelligence({
    assessmentId: 999,
    vendorName: "Smoke Test Vendor",
    frameworkName: "Truvern NIST 800-53 Governance Review",
    responses: [
      {
        questionId: 1,
        controlId: "AC-2",
        controlCode: "AC-2",
        family: "Access Control",
        answer: "No",
        weight: 10,
        requiresEvidence: true,
        requiresAttestation: true,
        evidence: null,
      },
      {
        questionId: 2,
        controlId: "IR-3",
        controlCode: "IR-3",
        family: "Incident Response",
        answer: "Partial",
        weight: 8,
        requiresEvidence: true,
        requiresAttestation: false,
        evidence: null,
      },
    ],
  });

  return NextResponse.json(
    {
      ok: true,
      recommendation: result.recommendation,
      riskLevel: result.score.riskLevel,
      score: result.score.percent,
      findings: result.findings.length,
      followUps: result.followUps.length,
      executiveSummary: result.executiveSummary,
    },
    { headers: { "cache-control": "no-store" } },
  );
}
