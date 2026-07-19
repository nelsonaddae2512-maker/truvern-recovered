require("ts-node/register");
require("tsconfig-paths/register");

const { runGovernanceIntelligence } = require("./lib/governance/intelligence/governance-intelligence-engine.ts");

const result = runGovernanceIntelligence({
  assessmentId: 999,
  vendorName: "Smoke Test Vendor",
  frameworkName: "Truvern NIST 800-53 Governance Review",
  responses: [
    {
      controlKey: "AC-2",
      controlCode: "AC-2",
      family: "Access Control",
      prompt: "Are accounts reviewed periodically?",
      answer: "No",
      weight: 10,
      requiresEvidence: true,
      requiresAttestation: true,
      evidence: null,
    },
    {
      controlKey: "IR-3",
      controlCode: "IR-3",
      family: "Incident Response",
      prompt: "Is incident response testing performed?",
      answer: "Partial",
      weight: 8,
      requiresEvidence: true,
      requiresAttestation: false,
      evidence: null,
    },
  ],
});

console.dir({
  recommendation: result.recommendation,
  riskLevel: result.score.riskLevel,
  score: result.score.percent,
  findings: result.findings.length,
  followUps: result.followUps.length,
  executiveSummary: result.executiveSummary,
}, { depth: null });
