#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const root = process.cwd();
const sourcePath = path.join(root, "tools", "atlas", "output", "refactoring-plan.json");
const rulesPath = path.join(root, "tools", "atlas", "portfolio-optimizer.rules.json");
const outDir = path.join(root, "tools", "atlas", "output");
const jsonPath = path.join(outDir, "refactoring-portfolio.json");
const mdPath = path.join(outDir, "refactoring-portfolio-report.md");

const read = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const uniq = (xs) => [...new Set((xs || []).filter(Boolean))];
const intersect = (a, b) => {
  const s = new Set(b || []);
  return (a || []).filter((x) => s.has(x));
};

function overlap(a, b, rules) {
  const sharedFiles = intersect(a.affectedFiles, b.affectedFiles);
  const denominator = Math.max(1, Math.min(a.affectedFileCount || 0, b.affectedFileCount || 0));
  const fileRatio = sharedFiles.length / denominator;
  const sameOwner = a.ownershipArea === b.ownershipArea ? 1 : 0;
  const sameCategory = a.category === b.category ? 1 : 0;
  const cfg = rules.overlap || {};
  const score =
    fileRatio * Number(cfg.sharedFileWeight || 0.7) +
    sameOwner * Number(cfg.sameOwnershipAreaWeight || 0.15) +
    sameCategory * Number(cfg.sameCategoryWeight || 0.15);
  return { score: Number(score.toFixed(3)), sharedFiles };
}

function phaseName(plan, rules) {
  const p = rules.phasing || {};
  if ((p.foundationRules || []).includes(plan.ruleId)) return "Foundation";
  if ((p.boundaryCategories || []).includes(plan.category)) return "Boundary cleanup";
  if ((p.hotspotCategories || []).includes(plan.category)) return "Hotspot reduction";
  if ((p.qualityCategories || []).includes(plan.category)) return "Quality and consolidation";
  return "Final hardening";
}

function planRank(plan, rules) {
  const p = rules.phasing || {};
  let score = 0;
  if ((p.foundationRules || []).includes(plan.ruleId)) score += 50;
  if (plan.category === "BOUNDARIES") score += 20;
  if (plan.category === "ARCHITECTURE_DRIFT") score += 15;
  if (plan.regressionRisk?.level === "HIGH") score += 8;
  score += Number(plan.estimatedScoreGain || 0) * 2;
  return score;
}

function optimize(source, rules) {
  const plans = (source.plans || []).slice(0, Number(rules.limits?.maximumPlans || 12));
  const matrix = [];
  for (let i = 0; i < plans.length; i++) {
    for (let j = i + 1; j < plans.length; j++) {
      const o = overlap(plans[i], plans[j], rules);
      matrix.push({
        planA: plans[i].id,
        planB: plans[j].id,
        score: o.score,
        sharedFiles: o.sharedFiles,
        mergeCandidate: o.score >= Number(rules.overlap?.mergeThreshold || 0.3)
      });
    }
  }
  matrix.sort((a, b) => b.score - a.score);

  const dependencies = matrix.filter((x) => x.mergeCandidate).map((pair) => {
    const a = plans.find((p) => p.id === pair.planA);
    const b = plans.find((p) => p.id === pair.planB);
    const before = planRank(a, rules) >= planRank(b, rules) ? a : b;
    const after = before.id === a.id ? b : a;
    return {
      before: before.id,
      after: after.id,
      strength: pair.score,
      reason: `Shares ${pair.sharedFiles.length} file(s); foundational work should land first.`
    };
  });

  const labels = ["Foundation", "Boundary cleanup", "Hotspot reduction", "Quality and consolidation", "Final hardening"];
  const groups = new Map(labels.map((label) => [label, []]));
  for (const plan of plans) groups.get(phaseName(plan, rules)).push(plan);

  const phases = [];
  let phaseNumber = 1;
  for (const label of labels) {
    const sorted = groups.get(label).sort((a, b) => planRank(b, rules) - planRank(a, rules) || a.priority - b.priority);
    const size = Number(rules.limits?.maximumPlansPerPhase || 6);
    for (let i = 0; i < sorted.length; i += size) {
      const batch = sorted.slice(i, i + size);
      if (!batch.length) continue;
      phases.push({
        phase: phaseNumber++,
        label: sorted.length > size ? `${label} ${Math.floor(i / size) + 1}` : label,
        planIds: batch.map((p) => p.id),
        planCount: batch.length,
        affectedFiles: uniq(batch.flatMap((p) => p.affectedFiles)),
        affectedFileCount: uniq(batch.flatMap((p) => p.affectedFiles)).length,
        estimatedHoursBeforeOverlap: Number((batch.reduce((s, p) => s + Number(p.effort?.minutes || 0), 0) / 60).toFixed(1)),
        potentialScoreGain: Number(batch.reduce((s, p) => s + Number(p.estimatedScoreGain || 0), 0).toFixed(1)),
        riskCounts: {
          HIGH: batch.filter((p) => p.regressionRisk?.level === "HIGH").length,
          MEDIUM: batch.filter((p) => p.regressionRisk?.level === "MEDIUM").length,
          LOW: batch.filter((p) => p.regressionRisk?.level === "LOW").length
        }
      });
    }
  }

  const originalMinutes = plans.reduce((s, p) => s + Number(p.effort?.minutes || 0), 0);
  const rawSavings = matrix.filter((x) => x.mergeCandidate)
    .reduce((s, x) => s + x.sharedFiles.length * Number(rules.effort?.sharedFileSavingsMinutes || 12), 0);
  const savings = Math.min(rawSavings, originalMinutes * Number(rules.effort?.maximumSavingsRatio || 0.4));
  const overhead = phases.length * Number(rules.effort?.coordinationOverheadMinutesPerPhase || 45);
  const optimizedMinutes = Math.max(0, Math.round(originalMinutes - savings + overhead));

  const safest = [...plans].sort((a, b) =>
    Number(a.regressionRisk?.score || 0) - Number(b.regressionRisk?.score || 0) ||
    Number(b.estimatedScoreGain || 0) - Number(a.estimatedScoreGain || 0) ||
    Number(a.effort?.minutes || 0) - Number(b.effort?.minutes || 0)
  )[0];

  return {
    generatedAt: new Date().toISOString(),
    schemaVersion: 1,
    engineVersion: "ATLAS-07A",
    sourcePlannerEngine: source.engineVersion,
    repositoryScore: source.repositoryScore,
    repositoryStatus: source.repositoryStatus,
    summary: {
      plansAnalyzed: plans.length,
      originalEstimatedHours: Number((originalMinutes / 60).toFixed(1)),
      overlapSavingsHours: Number((savings / 60).toFixed(1)),
      coordinationOverheadHours: Number((overhead / 60).toFixed(1)),
      optimizedEstimatedHours: Number((optimizedMinutes / 60).toFixed(1)),
      savingsPercent: originalMinutes ? Math.round((savings / originalMinutes) * 100) : 0,
      mergeCandidates: matrix.filter((x) => x.mergeCandidate).length,
      dependencyLinks: dependencies.length,
      phases: phases.length,
      potentialScoreGain: source.summary?.potentialScoreGain || 0,
      projectedMaximumScore: source.summary?.projectedMaximumScore || source.repositoryScore
    },
    safestFirstPlan: safest ? {
      id: safest.id,
      title: safest.title,
      risk: safest.regressionRisk.level,
      effortHours: safest.effort.hours,
      estimatedScoreGain: safest.estimatedScoreGain
    } : null,
    overlapMatrix: matrix.slice(0, 20),
    dependencies: dependencies.slice(0, 20),
    phases: phases.slice(0, Number(rules.limits?.maximumPhases || 4)),
    executionOrder: phases.flatMap((p) => p.planIds)
  };
}

function markdown(result) {
  const lines = [
    "# ATLAS Refactoring Portfolio Optimizer", "",
    `Generated: ${result.generatedAt}`,
    `Engine: ${result.engineVersion}`, "",
    "## Portfolio", "",
    `- Original estimate: ${result.summary.originalEstimatedHours} hours`,
    `- Overlap removed: ${result.summary.overlapSavingsHours} hours`,
    `- Coordination overhead: ${result.summary.coordinationOverheadHours} hours`,
    `- Optimized estimate: ${result.summary.optimizedEstimatedHours} hours`,
    `- Savings: ${result.summary.savingsPercent}%`,
    `- Merge candidates: ${result.summary.mergeCandidates}`, "",
    "## Phases", ""
  ];
  for (const p of result.phases) {
    lines.push(
      `### Phase ${p.phase} — ${p.label}`, "",
      `- Plans: ${p.planCount}`,
      `- Files: ${p.affectedFileCount}`,
      `- Pre-overlap effort: ${p.estimatedHoursBeforeOverlap} hours`,
      `- Score gain: +${p.potentialScoreGain}`,
      `- Order: ${p.planIds.join(" → ")}`, ""
    );
  }
  return lines.join("\n");
}

function analyze() {
  const source = read(sourcePath);
  if (source.engineVersion !== "ATLAS-07") throw new Error("ATLAS-07A requires ATLAS-07 output.");
  return optimize(source, read(rulesPath));
}

function write(result) {
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(jsonPath, JSON.stringify(result, null, 2) + "\n", "utf8");
  fs.writeFileSync(mdPath, markdown(result) + "\n", "utf8");
}

function main() {
  const cmd = process.argv[2] || "help";
  if (cmd === "report" || cmd === "analyze") {
    const result = analyze();
    write(result);
    if (cmd === "analyze") console.log(JSON.stringify(result, null, 2));
    else {
      console.log("ATLAS-07A Refactoring Portfolio Optimizer complete.");
      console.log(`Plans analyzed: ${result.summary.plansAnalyzed}`);
      console.log(`Original estimate: ${result.summary.originalEstimatedHours} hours`);
      console.log(`Overlap removed: ${result.summary.overlapSavingsHours} hours`);
      console.log(`Optimized estimate: ${result.summary.optimizedEstimatedHours} hours`);
      console.log(`Savings: ${result.summary.savingsPercent}%`);
      console.log(`Phases: ${result.summary.phases}`);
      console.log(`Merge candidates: ${result.summary.mergeCandidates}`);
      console.log(`JSON: ${jsonPath}`);
      console.log(`Report: ${mdPath}`);
    }
    return;
  }
  if (cmd === "self-test") {
    const sample = {
      engineVersion: "ATLAS-07", repositoryScore: 75, repositoryStatus: "ATTENTION",
      summary: { potentialScoreGain: 7, projectedMaximumScore: 82 },
      plans: [
        { id:"REF-001", priority:1, title:"Break cycle", ruleId:"DEPENDENCY-CYCLE", category:"ARCHITECTURE_DRIFT", ownershipArea:"components/review", affectedFiles:["components/review/a.tsx","lib/review/service.ts"], affectedFileCount:2, affectedEdgeCount:8, effort:{minutes:180,hours:3}, regressionRisk:{level:"MEDIUM",score:6}, estimatedScoreGain:4 },
        { id:"REF-002", priority:2, title:"Move server access", ruleId:"CLIENT-TO-SERVER-ONLY", category:"BOUNDARIES", ownershipArea:"components/review", affectedFiles:["components/review/a.tsx","lib/review/service.ts","lib/review/types.ts"], affectedFileCount:3, affectedEdgeCount:10, effort:{minutes:240,hours:4}, regressionRisk:{level:"LOW",score:4}, estimatedScoreGain:3 }
      ]
    };
    const result = optimize(sample, read(rulesPath));
    if (result.summary.mergeCandidates < 1) throw new Error("Self-test failed: overlap missing.");
    if (!result.phases.length) throw new Error("Self-test failed: phases missing.");
    if (!result.executionOrder.length) throw new Error("Self-test failed: execution order missing.");
    console.log("ATLAS-07A Refactoring Portfolio Optimizer self-test passed.");
    console.log(`Original: ${result.summary.originalEstimatedHours} hours`);
    console.log(`Optimized: ${result.summary.optimizedEstimatedHours} hours`);
    console.log(`Savings: ${result.summary.savingsPercent}%`);
    console.log(`Phases: ${result.summary.phases}`);
    return;
  }
  console.log("ATLAS-07A Refactoring Portfolio Optimizer");
  console.log("Commands: analyze | report | self-test");
}
module.exports = { analyze, optimize, markdown };
if (require.main === module) main();
