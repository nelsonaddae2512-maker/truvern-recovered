#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const root = process.cwd();
const portfolioPath = path.join(root, "tools", "atlas", "output", "refactoring-portfolio.json");
const plannerPath = path.join(root, "tools", "atlas", "output", "refactoring-plan.json");
const rulesPath = path.join(root, "tools", "atlas", "patch-generator.rules.json");
const outputDir = path.join(root, "tools", "atlas", "output");
const bundleDir = path.join(outputDir, "patch-bundles");
const jsonPath = path.join(outputDir, "patch-plan.json");
const markdownPath = path.join(outputDir, "patch-plan-report.md");

const read = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const uniq = (xs) => [...new Set((xs || []).filter(Boolean))];

function sanitize(value) {
  return String(value || "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function buildPatchInstructions(plan) {
  const instructions = [];
  instructions.push(`Implement root cause ${plan.rootCauseId || plan.ruleId}.`);
  instructions.push(`Keep the change scoped to ${plan.ownershipArea}.`);
  if (plan.centralAsset) instructions.push(`Treat ${plan.centralAsset} as the primary architecture boundary.`);
  for (const step of plan.steps || []) {
    instructions.push(`${step.order}. ${step.title}: ${step.description}`);
  }
  instructions.push("Do not change unrelated behavior.");
  instructions.push("Preserve public API compatibility unless the plan explicitly requires a boundary change.");
  return instructions;
}

function patchRisk(plan) {
  const level = plan.regressionRisk?.level || "MEDIUM";
  const fileCount = Number(plan.affectedFileCount || 0);
  if (level === "HIGH" || fileCount > 10) return "HIGH";
  if (level === "MEDIUM" || fileCount > 5) return "MEDIUM";
  return "LOW";
}

function splitFiles(files, maxFiles) {
  const chunks = [];
  for (let i = 0; i < files.length; i += maxFiles) chunks.push(files.slice(i, i + maxFiles));
  return chunks.length ? chunks : [[]];
}

function generate(sourcePortfolio, sourcePlanner, rules) {
  const plansById = new Map((sourcePlanner.plans || []).map((plan) => [plan.id, plan]));
  const patches = [];
  let counter = 1;

  for (const phase of (sourcePortfolio.phases || []).slice(0, Number(rules.limits?.maximumPhases || 4))) {
    let phasePatchCount = 0;
    for (const planId of phase.planIds || []) {
      const plan = plansById.get(planId);
      if (!plan) continue;

      const fileGroups = splitFiles(
        uniq(plan.affectedFiles || []),
        Number(rules.limits?.maximumFilesPerPatch || 12),
      );

      for (let groupIndex = 0; groupIndex < fileGroups.length; groupIndex += 1) {
        if (phasePatchCount >= Number(rules.limits?.maximumPatchesPerPhase || 8)) break;
        const id = `PATCH-${String(counter).padStart(3, "0")}`;
        const files = fileGroups[groupIndex];
        const titleSuffix = fileGroups.length > 1 ? ` (${groupIndex + 1}/${fileGroups.length})` : "";

        patches.push({
          id,
          phase: phase.phase,
          phaseLabel: phase.label,
          sourcePlanId: plan.id,
          title: `${plan.title}${titleSuffix}`,
          status: "PROPOSED",
          mode: "REVIEW_ONLY",
          risk: patchRisk(plan),
          recommendedOwner: plan.recommendedOwner,
          ownershipArea: plan.ownershipArea,
          affectedFiles: files,
          affectedFileCount: files.length,
          estimatedHours: Number(
            ((Number(plan.effort?.hours || 0) / Math.max(1, fileGroups.length))).toFixed(1),
          ),
          estimatedScoreGain: Number(
            ((Number(plan.estimatedScoreGain || 0) / Math.max(1, fileGroups.length))).toFixed(2),
          ),
          instructions: buildPatchInstructions(plan).slice(
            0,
            Number(rules.limits?.maximumInstructionsPerPatch || 12),
          ),
          validationCommands: rules.validationCommands || [],
          rollback: plan.rollback || [],
          reviewChecklist: [
            "Review every proposed file before editing.",
            "Create or confirm a repository checkpoint.",
            "Generate a unified diff in a clean working tree.",
            "Run git apply --check against the diff before applying.",
            "Run all configured validation commands.",
            "Review the resulting graph and governance score.",
            "Commit this patch separately from unrelated work."
          ],
          artifactFiles: {
            manifest: `${id}/manifest.json`,
            workOrder: `${id}/WORK-ORDER.md`,
            diffPlaceholder: `${id}/candidate.patch`
          }
        });

        counter += 1;
        phasePatchCount += 1;
      }
    }
  }

  const totalHours = patches.reduce((sum, patch) => sum + Number(patch.estimatedHours || 0), 0);
  const totalGain = patches.reduce((sum, patch) => sum + Number(patch.estimatedScoreGain || 0), 0);

  return {
    generatedAt: new Date().toISOString(),
    schemaVersion: 1,
    engineVersion: "ATLAS-08",
    mode: "REVIEW_ONLY",
    sourcePortfolioEngine: sourcePortfolio.engineVersion,
    sourcePlannerEngine: sourcePlanner.engineVersion,
    repositoryScore: sourcePortfolio.repositoryScore,
    repositoryStatus: sourcePortfolio.repositoryStatus,
    summary: {
      phases: uniq(patches.map((p) => p.phase)).length,
      patchesGenerated: patches.length,
      affectedFiles: uniq(patches.flatMap((p) => p.affectedFiles)).length,
      estimatedHours: Number(totalHours.toFixed(1)),
      estimatedScoreGain: Number(totalGain.toFixed(1)),
      highRiskPatches: patches.filter((p) => p.risk === "HIGH").length,
      mediumRiskPatches: patches.filter((p) => p.risk === "MEDIUM").length,
      lowRiskPatches: patches.filter((p) => p.risk === "LOW").length
    },
    executionOrder: patches.map((p) => p.id),
    patches
  };
}

function workOrder(patch) {
  const lines = [
    `# ${patch.id} — ${patch.title}`, "",
    `- Phase: ${patch.phase} — ${patch.phaseLabel}`,
    `- Source plan: ${patch.sourcePlanId}`,
    `- Status: ${patch.status}`,
    `- Mode: ${patch.mode}`,
    `- Risk: ${patch.risk}`,
    `- Owner: ${patch.recommendedOwner}`,
    `- Estimated effort: ${patch.estimatedHours} hours`,
    `- Estimated score gain: +${patch.estimatedScoreGain}`, "",
    "## Affected Files", "",
    ...(patch.affectedFiles.length ? patch.affectedFiles.map((f) => `- \`${f}\``) : ["- No files inferred; manual scoping required."]),
    "", "## Implementation Instructions", "",
    ...patch.instructions.map((x) => `- ${x}`),
    "", "## Validation", "",
    ...patch.validationCommands.map((x) => `- \`${x}\``),
    "", "## Rollback", "",
    ...patch.rollback.map((x) => `- ${x}`),
    "", "## Review Checklist", "",
    ...patch.reviewChecklist.map((x) => `- [ ] ${x}`),
    "", "## Candidate Diff", "",
    "The generator intentionally leaves `candidate.patch` empty.",
    "A human-reviewed diff must be created from the real repository state.",
    ""
  ];
  return lines.join("\n");
}

function markdown(result) {
  const lines = [
    "# ATLAS Intelligent Patch Generator", "",
    `Generated: ${result.generatedAt}`,
    `Engine: ${result.engineVersion}`,
    `Mode: ${result.mode}`, "",
    "## Summary", "",
    `- Patches generated: ${result.summary.patchesGenerated}`,
    `- Affected files: ${result.summary.affectedFiles}`,
    `- Estimated effort: ${result.summary.estimatedHours} hours`,
    `- Estimated score gain: +${result.summary.estimatedScoreGain}`,
    `- High risk: ${result.summary.highRiskPatches}`,
    `- Medium risk: ${result.summary.mediumRiskPatches}`,
    `- Low risk: ${result.summary.lowRiskPatches}`, "",
    "## Execution Order", ""
  ];
  for (const patch of result.patches) {
    lines.push(
      `### ${patch.id} — ${patch.title}`, "",
      `- Phase: ${patch.phase} — ${patch.phaseLabel}`,
      `- Risk: ${patch.risk}`,
      `- Files: ${patch.affectedFileCount}`,
      `- Effort: ${patch.estimatedHours} hours`,
      `- Score gain: +${patch.estimatedScoreGain}`,
      `- Source plan: ${patch.sourcePlanId}`, ""
    );
  }
  return lines.join("\n");
}

function write(result) {
  fs.mkdirSync(outputDir, { recursive: true });
  fs.rmSync(bundleDir, { recursive: true, force: true });
  fs.mkdirSync(bundleDir, { recursive: true });

  fs.writeFileSync(jsonPath, JSON.stringify(result, null, 2) + "\n", "utf8");
  fs.writeFileSync(markdownPath, markdown(result) + "\n", "utf8");

  for (const patch of result.patches) {
    const patchDir = path.join(bundleDir, patch.id);
    fs.mkdirSync(patchDir, { recursive: true });
    fs.writeFileSync(path.join(patchDir, "manifest.json"), JSON.stringify(patch, null, 2) + "\n", "utf8");
    fs.writeFileSync(path.join(patchDir, "WORK-ORDER.md"), workOrder(patch) + "\n", "utf8");
    fs.writeFileSync(
      path.join(patchDir, "candidate.patch"),
      `# ${patch.id}\n# REVIEW_ONLY placeholder. Generate a real unified diff after reviewing WORK-ORDER.md.\n`,
      "utf8",
    );
  }
}

function analyze() {
  const portfolio = read(portfolioPath);
  const planner = read(plannerPath);
  if (portfolio.engineVersion !== "ATLAS-07A") throw new Error("ATLAS-08 requires ATLAS-07A output.");
  if (planner.engineVersion !== "ATLAS-07") throw new Error("ATLAS-08 requires ATLAS-07 output.");
  return generate(portfolio, planner, read(rulesPath));
}

function main() {
  const cmd = process.argv[2] || "help";

  if (cmd === "report" || cmd === "analyze") {
    const result = analyze();
    write(result);
    if (cmd === "analyze") console.log(JSON.stringify(result, null, 2));
    else {
      console.log("ATLAS-08 Intelligent Patch Generator complete.");
      console.log(`Mode: ${result.mode}`);
      console.log(`Patches generated: ${result.summary.patchesGenerated}`);
      console.log(`Affected files: ${result.summary.affectedFiles}`);
      console.log(`Estimated effort: ${result.summary.estimatedHours} hours`);
      console.log(`Estimated score gain: +${result.summary.estimatedScoreGain}`);
      console.log(`High-risk patches: ${result.summary.highRiskPatches}`);
      console.log(`JSON: ${jsonPath}`);
      console.log(`Report: ${markdownPath}`);
      console.log(`Bundles: ${bundleDir}`);
    }
    return;
  }

  if (cmd === "self-test") {
    const portfolio = {
      engineVersion: "ATLAS-07A",
      repositoryScore: 75,
      repositoryStatus: "ATTENTION",
      phases: [{ phase: 1, label: "Foundation", planIds: ["REF-001"] }]
    };
    const planner = {
      engineVersion: "ATLAS-07",
      plans: [{
        id: "REF-001",
        title: "Break dependency cycle",
        rootCauseId: "ROOT-001",
        ruleId: "DEPENDENCY-CYCLE",
        ownershipArea: "components/review",
        recommendedOwner: "Product Engineering",
        centralAsset: "components/review/a.tsx",
        affectedFiles: ["components/review/a.tsx", "lib/review/service.ts"],
        affectedFileCount: 2,
        effort: { hours: 3 },
        regressionRisk: { level: "MEDIUM" },
        estimatedScoreGain: 2.5,
        steps: [{ order: 1, title: "Extract contract", description: "Move shared types." }],
        rollback: ["Restore checkpoint."]
      }]
    };
    const result = generate(portfolio, planner, read(rulesPath));
    if (result.summary.patchesGenerated !== 1) throw new Error("Self-test failed: patch missing.");
    if (result.patches[0].mode !== "REVIEW_ONLY") throw new Error("Self-test failed: unsafe mode.");
    if (!result.patches[0].reviewChecklist.length) throw new Error("Self-test failed: checklist missing.");
    console.log("ATLAS-08 Intelligent Patch Generator self-test passed.");
    console.log(`Patches: ${result.summary.patchesGenerated}`);
    console.log(`Mode: ${result.mode}`);
    console.log(`Risk: ${result.patches[0].risk}`);
    return;
  }

  console.log("ATLAS-08 Intelligent Patch Generator");
  console.log("Commands: analyze | report | self-test");
}

module.exports = { analyze, generate, markdown };
if (require.main === module) main();
