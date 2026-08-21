#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const root = process.cwd();
const graphPath = path.join(root, "tools", "atlas", "output", "explorer-graph.json");
const rulesPath = path.join(root, "tools", "atlas", "repository-governance.rules.json");
const outputDir = path.join(root, "tools", "atlas", "output");
const jsonPath = path.join(outputDir, "repository-governance.json");
const markdownPath = path.join(outputDir, "repository-governance-report.md");

const severityOrder = { INFO: 0, LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function normalizePath(value) {
  return String(value || "").replace(/\\/g, "/").replace(/^\.?\//, "");
}

function nodePath(node) {
  const metadata = node.metadata || {};
  const values = [metadata.file, metadata.path, metadata.filePath, metadata.source, node.id];
  const candidate = values.find((value) => typeof value === "string" && (value.includes("/") || value.includes("\\")));
  return normalizePath(candidate || node.id || "");
}

function nodeText(node) {
  return `${node.type || ""} ${node.label || ""} ${node.id || ""}`.toLowerCase();
}

function includesAny(value, markers) {
  const lower = String(value || "").toLowerCase();
  return (markers || []).some((marker) => lower.includes(String(marker).toLowerCase()));
}

function startsWithAny(value, prefixes) {
  return (prefixes || []).some((prefix) => normalizePath(value).startsWith(normalizePath(prefix)));
}

function endsWithAny(value, suffixes) {
  return !suffixes?.length || suffixes.some((suffix) => String(value).toLowerCase().endsWith(String(suffix).toLowerCase()));
}

function listFiles(directory) {
  const ignored = new Set([".git", ".next", "node_modules", "coverage", "dist", "build", "Truvern-Backups"]);
  const files = [];

  function walk(current) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (ignored.has(entry.name)) continue;
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) walk(absolute);
      else files.push(normalizePath(path.relative(directory, absolute)));
    }
  }

  walk(directory);
  return files;
}

function isSuppressed(asset, rules) {
  return (rules.suppressions || []).some((item) => startsWithAny(asset, item.pathPrefixes || []));
}

function makeFinding(input) {
  return {
    ruleId: input.ruleId,
    category: input.category,
    severity: input.severity,
    confidence: input.confidence ?? 0.75,
    title: input.title,
    description: input.description,
    asset: input.asset || null,
    remediation: input.remediation,
    evidence: (input.evidence || []).filter(Boolean),
    occurrences: Math.max(1, Number(input.occurrences || 1)),
    ownershipArea: input.ownershipArea || null,
    centralAsset: input.centralAsset || null,
  };
}

function cleanSegment(segment) {
  return String(segment || "")
    .replace(/^\(|\)$/g, "")
    .replace(/^\[|\]$/g, "")
    .replace(/\.[jt]sx?$/i, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function ownershipArea(asset, rules) {
  const normalized = normalizePath(asset);
  const parts = normalized.split("/").filter(Boolean);
  if (!parts.length) return "repository";

  const config = rules.rootCauseIntelligence || {};
  const maxByRoot = config.ownershipSegments || {};
  const rootName = parts[0];
  const take = Number(maxByRoot[rootName] || 2);
  const generic = new Set((config.genericSegments || []).map((item) => String(item).toLowerCase()));

  const meaningful = parts
    .slice(0, Math.max(2, take + 2))
    .map(cleanSegment)
    .filter((item) => item && !generic.has(item.toLowerCase()));

  if (rootName === "app") {
    const apiIndex = parts.indexOf("api");
    if (apiIndex >= 0) {
      const candidate = cleanSegment(parts[apiIndex + 1]);
      if (candidate) return `api/${candidate}`;
    }
  }

  if (meaningful.length) {
    return `${rootName}/${meaningful.slice(0, Math.max(1, take - 1)).join("/")}`;
  }
  return rootName;
}

function centralAssetForAssets(assets) {
  const counts = new Map();
  for (const asset of assets) {
    const normalized = normalizePath(asset);
    if (!normalized) continue;
    counts.set(normalized, (counts.get(normalized) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] || null;
}

function clusterCycles(cycles, rules) {
  const normalizedCycles = cycles.map((cycle) => [...new Set((cycle || []).map(normalizePath).filter(Boolean))]);
  const parent = normalizedCycles.map((_, index) => index);

  function find(value) {
    while (parent[value] !== value) {
      parent[value] = parent[parent[value]];
      value = parent[value];
    }
    return value;
  }

  function union(a, b) {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA !== rootB) parent[rootB] = rootA;
  }

  const minimumOverlap = Number(rules.rootCauseIntelligence?.cycleOverlapMinimum || 1);
  const nodeToCycles = new Map();

  normalizedCycles.forEach((cycle, index) => {
    for (const node of cycle) {
      if (!nodeToCycles.has(node)) nodeToCycles.set(node, []);
      nodeToCycles.get(node).push(index);
    }
  });

  for (const indexes of nodeToCycles.values()) {
    if (minimumOverlap <= 1) {
      for (let index = 1; index < indexes.length; index += 1) union(indexes[0], indexes[index]);
      continue;
    }

    for (let a = 0; a < indexes.length; a += 1) {
      for (let b = a + 1; b < indexes.length; b += 1) {
        const left = new Set(normalizedCycles[indexes[a]]);
        const overlap = normalizedCycles[indexes[b]].filter((node) => left.has(node)).length;
        if (overlap >= minimumOverlap) union(indexes[a], indexes[b]);
      }
    }
  }

  const clusters = new Map();
  normalizedCycles.forEach((cycle, index) => {
    const rootIndex = find(index);
    if (!clusters.has(rootIndex)) clusters.set(rootIndex, []);
    clusters.get(rootIndex).push(cycle);
  });

  return [...clusters.values()].map((cluster) => {
    const allAssets = cluster.flat();
    const counts = new Map();
    for (const asset of allAssets) counts.set(asset, (counts.get(asset) || 0) + 1);
    const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    return {
      cycleCount: cluster.length,
      assets: ranked.map(([asset]) => asset),
      centralAsset: ranked[0]?.[0] || null,
    };
  });
}

function rawFindings(graph, rules, files) {
  const findings = [];
  const nodeMap = new Map((graph.nodes || []).map((node) => [node.id, node]));

  for (const rule of rules.pathRules || []) {
    for (const node of graph.nodes || []) {
      const asset = nodePath(node);
      if (!asset || isSuppressed(asset, rules)) continue;
      if (!includesAny(nodeText(node), rule.nodeTypeContains || [])) continue;
      if (!endsWithAny(asset, rule.requiredFileSuffixes || [])) continue;
      if (startsWithAny(asset, rule.allowedPathPrefixes || [])) continue;

      findings.push(makeFinding({
        ruleId: rule.id,
        category: "BOUNDARIES",
        severity: rule.severity,
        confidence: rule.confidence,
        title: "Architecture asset is outside its governed location",
        description: rule.description,
        asset,
        ownershipArea: ownershipArea(asset, rules),
        centralAsset: asset,
        remediation: `Move or reclassify this asset under: ${(rule.allowedPathPrefixes || []).join(", ")}.`,
        evidence: [node.label, node.type],
      }));
    }
  }

  for (const rule of rules.forbiddenDependencies || []) {
    for (const edge of graph.edges || []) {
      const source = nodeMap.get(edge.source);
      const target = nodeMap.get(edge.target);
      if (!source || !target) continue;

      const sourcePath = nodePath(source);
      const targetPath = nodePath(target);
      if (isSuppressed(sourcePath, rules) || isSuppressed(targetPath, rules)) continue;

      const sourceTypeMatch = includesAny(nodeText(source), rule.sourceTypeContains || []);
      const sourcePathMatch = !rule.sourcePathContains?.length || includesAny(sourcePath, rule.sourcePathContains);
      const targetTypeMatch = includesAny(nodeText(target), rule.targetTypeContains || []);
      const targetPathMatch =
        (!rule.targetPathPrefixes?.length || startsWithAny(targetPath, rule.targetPathPrefixes)) &&
        (!rule.targetPathContains?.length || includesAny(targetPath, rule.targetPathContains));

      if (!(sourceTypeMatch && sourcePathMatch && targetTypeMatch && targetPathMatch)) continue;

      findings.push(makeFinding({
        ruleId: rule.id,
        category: "BOUNDARIES",
        severity: rule.severity,
        confidence: rule.confidence,
        title: "Forbidden architecture dependency",
        description: rule.description,
        asset: `${sourcePath} -> ${targetPath}`,
        ownershipArea: ownershipArea(sourcePath, rules),
        centralAsset: sourcePath,
        remediation: "Introduce a server/domain boundary and remove the direct dependency.",
        evidence: [source.label, target.label, edge.type || "depends_on"],
      }));
    }
  }

  const cycles = (graph.overlays?.cycles || []).slice(0, rules.cycleRules?.maximumRawCycles || 500);
  for (const cluster of clusterCycles(cycles, rules)) {
    const area = ownershipArea(cluster.centralAsset || cluster.assets[0] || "repository", rules);
    findings.push(makeFinding({
      ruleId: "DEPENDENCY-CYCLE",
      category: "ARCHITECTURE_DRIFT",
      severity: rules.cycleRules?.severity || "MEDIUM",
      confidence: rules.cycleRules?.confidence || 0.85,
      title: "Connected dependency-cycle cluster",
      description: `${cluster.cycleCount} circular dependency path(s) share architecture assets and likely stem from one boundary problem.`,
      asset: cluster.centralAsset || area,
      ownershipArea: area,
      centralAsset: cluster.centralAsset,
      occurrences: cluster.cycleCount,
      remediation: "Break the shared cycle cluster at its central dependency with a stable interface, domain service, or dependency inversion.",
      evidence: cluster.assets.slice(0, 20),
    }));
  }

  const high = Number(rules.hotspotRules?.highImpactScore || 75);
  const critical = Number(rules.hotspotRules?.criticalImpactScore || 92);
  for (const node of graph.nodes || []) {
    const score = Number(node.impact?.score || 0);
    if (score < high) continue;
    const asset = nodePath(node);
    if (!asset || isSuppressed(asset, rules)) continue;

    findings.push(makeFinding({
      ruleId: "HIGH-IMPACT-HOTSPOT",
      category: "HOTSPOTS",
      severity: score >= critical ? "HIGH" : "MEDIUM",
      confidence: rules.hotspotRules?.minimumConfidence || 0.75,
      title: "High-impact architecture hotspot",
      description: "This asset has a broad dependency or feature blast radius.",
      asset,
      ownershipArea: ownershipArea(asset, rules),
      centralAsset: asset,
      remediation: "Add focused regression coverage and split responsibilities before further expansion.",
      evidence: [node.label, node.type, `impact-score:${score}`, ...(node.features || []).slice(0, 6)],
    }));
  }

  const labelGroups = new Map();
  for (const node of graph.nodes || []) {
    const key = String(node.label || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    if (key.length < 12) continue;
    const asset = nodePath(node);
    if (!asset || isSuppressed(asset, rules)) continue;
    if (!labelGroups.has(key)) labelGroups.set(key, []);
    labelGroups.get(key).push(asset);
  }

  for (const [label, assets] of labelGroups) {
    const unique = [...new Set(assets)];
    if (unique.length < 2) continue;
    const central = centralAssetForAssets(unique);
    findings.push(makeFinding({
      ruleId: "POSSIBLE-DUPLICATE-IMPLEMENTATION",
      category: "DUPLICATION",
      severity: "LOW",
      confidence: 0.55,
      title: "Possible overlapping implementation",
      description: "Multiple architecture assets share the same normalized label.",
      asset: label,
      ownershipArea: ownershipArea(central || unique[0], rules),
      centralAsset: central,
      occurrences: unique.length,
      remediation: "Confirm whether these implementations are intentionally separate; consolidate shared behavior where appropriate.",
      evidence: unique.slice(0, 12),
    }));
  }

  const testMarkers = rules.qualityRules?.testPathMarkers || [];
  const testFiles = files.filter((file) => testMarkers.some((marker) => file.includes(marker)));
  const docs = files.filter((file) => startsWithAny(file, rules.qualityRules?.documentationPathPrefixes || []));

  if (testFiles.length === 0) {
    findings.push(makeFinding({
      ruleId: "NO-TEST-FILES-DETECTED",
      category: "QUALITY",
      severity: "HIGH",
      confidence: 0.95,
      title: "No repository test files were detected",
      description: "ATLAS could not find files matching the configured test markers.",
      ownershipArea: "repository/quality",
      remediation: "Add focused automated tests for high-impact domain, API, and workflow paths.",
      evidence: testMarkers,
    }));
  }

  const minimumDocs = Number(rules.qualityRules?.minimumDocumentationFiles || 3);
  if (docs.length < minimumDocs) {
    findings.push(makeFinding({
      ruleId: "INSUFFICIENT-DOCUMENTATION",
      category: "QUALITY",
      severity: "MEDIUM",
      confidence: 0.9,
      title: "Documentation coverage is below policy",
      description: `Detected ${docs.length} documentation files; policy requires at least ${minimumDocs}.`,
      ownershipArea: "repository/documentation",
      remediation: "Document architecture decisions, release procedures, and critical workflows.",
      evidence: docs,
    }));
  }

  return { findings, testFiles, docs, rawOccurrenceCount: findings.reduce((sum, item) => sum + item.occurrences, 0) };
}

function clusterKey(finding) {
  const area = finding.ownershipArea || "repository";
  if (finding.ruleId === "DEPENDENCY-CYCLE") {
    return `${finding.category}|${finding.ruleId}|${finding.centralAsset || area}`;
  }
  if (finding.category === "QUALITY") {
    return `${finding.category}|${finding.ruleId}|repository`;
  }
  return `${finding.category}|${finding.ruleId}|${area}`;
}

function buildRootCauses(findings, rules) {
  const groups = new Map();

  for (const finding of findings) {
    const key = clusterKey(finding);
    if (!groups.has(key)) {
      groups.set(key, {
        id: key,
        category: finding.category,
        ruleId: finding.ruleId,
        ownershipArea: finding.ownershipArea || "repository",
        centralAsset: finding.centralAsset || null,
        title: finding.title,
        severity: finding.severity,
        confidence: finding.confidence,
        findingCount: 0,
        occurrenceCount: 0,
        assets: [],
        evidence: [],
        remediation: finding.remediation,
      });
    }

    const group = groups.get(key);
    group.findingCount += 1;
    group.occurrenceCount += finding.occurrences || 1;
    group.confidence = Math.max(group.confidence, finding.confidence);
    if (severityOrder[finding.severity] > severityOrder[group.severity]) group.severity = finding.severity;
    if (finding.asset) group.assets.push(finding.asset);
    group.evidence.push(...finding.evidence);
  }

  const maxAssets = Number(rules.rootCauseIntelligence?.maximumRepresentativeAssets || 10);
  return [...groups.values()]
    .map((group) => ({
      ...group,
      assets: [...new Set(group.assets)].slice(0, maxAssets),
      evidence: [...new Set(group.evidence)].slice(0, maxAssets),
      estimatedScoreGain: 0,
      impactScore:
        severityOrder[group.severity] * 20 +
        Math.min(25, Math.log2(group.occurrenceCount + 1) * 6) +
        Math.round(group.confidence * 10),
    }))
    .sort((a, b) => b.impactScore - a.impactScore || b.occurrenceCount - a.occurrenceCount)
    .slice(0, Number(rules.rootCauseIntelligence?.maximumRootCauses || 30));
}

function scoreRepository(rootCauses, rules) {
  const categoryConfig = rules.scoring?.categories || {};
  const multipliers = rules.scoring?.severityMultipliers || {};
  const scoreComponents = [];

  for (const [category, config] of Object.entries(categoryConfig)) {
    const categoryCauses = rootCauses.filter((item) => item.category === category);
    const rawRisk = categoryCauses.reduce(
      (sum, cause) =>
        sum +
        Number(multipliers[cause.severity] || 0) *
          Number(cause.confidence || 0.75) *
          Math.min(3.5, Math.log2((cause.occurrenceCount || 1) + 1)),
      0,
    );
    const scale = Math.max(1, Number(config.scale || 10));
    const riskRatio = 1 - Math.exp(-rawRisk / scale);
    const deduction = Number((Number(config.weight || 0) * riskRatio).toFixed(1));

    scoreComponents.push({
      category,
      weight: Number(config.weight || 0),
      rawRisk: Number(rawRisk.toFixed(2)),
      deduction,
      score: Number((Number(config.weight || 0) - deduction).toFixed(1)),
      rootCauseCount: categoryCauses.length,
      occurrenceCount: categoryCauses.reduce((sum, item) => sum + item.occurrenceCount, 0),
    });
  }

  const totalDeduction = scoreComponents.reduce((sum, item) => sum + item.deduction, 0);
  const score = Math.max(0, Math.min(100, Math.round(100 - totalDeduction)));
  return { score, scoreComponents };
}

function evaluate(graph, rules, files) {
  const raw = rawFindings(graph, rules, files);
  const causes = buildRootCauses(raw.findings, rules);
  const { score, scoreComponents } = scoreRepository(causes, rules);

  const thresholds = rules.scoreThresholds || {};
  const status =
    score >= Number(thresholds.healthy || 88) ? "HEALTHY" :
    score >= Number(thresholds.attention || 75) ? "ATTENTION" :
    score >= Number(thresholds.reviewRequired || 60) ? "REVIEW_REQUIRED" :
    "BLOCKED";

  const blockingReasons = [];
  const minConfidence = Number(rules.enforcement?.minimumCriticalConfidence || 0.8);
  const criticalBoundaries = causes.filter(
    (item) => item.category === "BOUNDARIES" && item.severity === "CRITICAL" && item.confidence >= minConfidence,
  );

  if (rules.enforcement?.blockOnCriticalBoundary && criticalBoundaries.length) {
    blockingReasons.push(`${criticalBoundaries.length} high-confidence critical boundary root cause(s) detected.`);
  }
  if (score < Number(rules.enforcement?.blockBelowScore || 55)) {
    blockingReasons.push(`Governance score ${score} is below the enforced threshold.`);
  }

  const componentByCategory = new Map(scoreComponents.map((item) => [item.category, item]));
  for (const cause of causes) {
    const component = componentByCategory.get(cause.category);
    const categoryImpact = causes
      .filter((item) => item.category === cause.category)
      .reduce((sum, item) => sum + item.impactScore, 0);
    const share = categoryImpact ? cause.impactScore / categoryImpact : 0;
    cause.estimatedScoreGain = Number(Math.min(10, (component?.deduction || 0) * share * 0.75).toFixed(1));
  }

  const severityCounts = { INFO: 0, LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 };
  const categoryCounts = {};
  for (const cause of causes) {
    severityCounts[cause.severity] += 1;
    categoryCounts[cause.category] = (categoryCounts[cause.category] || 0) + 1;
  }

  const maxActions = Number(rules.rootCauseIntelligence?.maximumActions || 12);
  const recommendations = causes.slice(0, maxActions).map((cause) => ({
    title: `${cause.title} — ${cause.ownershipArea}`,
    ruleId: cause.ruleId,
    severity: cause.severity,
    ownershipArea: cause.ownershipArea,
    centralAsset: cause.centralAsset,
    affectedFindings: cause.findingCount,
    affectedOccurrences: cause.occurrenceCount,
    estimatedScoreGain: cause.estimatedScoreGain,
    action: cause.remediation,
  }));

  return {
    generatedAt: new Date().toISOString(),
    schemaVersion: 3,
    engineVersion: "ATLAS-06B.2",
    status,
    score,
    enforceable: blockingReasons.length === 0,
    blockingReasons,
    summary: {
      nodes: graph.nodes?.length || 0,
      edges: graph.edges?.length || 0,
      cycles: graph.overlays?.cycles?.length || 0,
      rawOccurrences: raw.rawOccurrenceCount,
      detailedFindings: raw.findings.length,
      architecturalRootCauses: causes.length,
      actionableFindings: recommendations.length,
      repositoryFiles: files.length,
      testFiles: raw.testFiles.length,
      documentationFiles: raw.docs.length,
      consolidationPercent: raw.rawOccurrenceCount
        ? Math.round((1 - causes.length / raw.rawOccurrenceCount) * 100)
        : 0,
    },
    severityCounts,
    categoryCounts,
    scoreComponents,
    rootCauses: causes,
    violations: causes,
    recommendations,
    policy: {
      scoreThresholds: rules.scoreThresholds,
      enforcement: rules.enforcement,
    },
  };
}

function markdown(result) {
  const lines = [
    "# ATLAS Architectural Root Cause Intelligence",
    "",
    `Generated: ${result.generatedAt}`,
    `Engine: ${result.engineVersion}`,
    `Status: **${result.status}**`,
    `Score: **${result.score}/100**`,
    `Enforcement: **${result.enforceable ? "PASS" : "BLOCK"}**`,
    "",
    "## Consolidation",
    "",
    `- Raw occurrences: ${result.summary.rawOccurrences}`,
    `- Detailed findings: ${result.summary.detailedFindings}`,
    `- Architectural root causes: ${result.summary.architecturalRootCauses}`,
    `- Actionable recommendations: ${result.summary.actionableFindings}`,
    `- Consolidation: ${result.summary.consolidationPercent}%`,
    "",
    "## Weighted Repository Health",
    "",
    ...result.scoreComponents.map((item) =>
      `- ${item.category}: ${item.score}/${item.weight} (${item.rootCauseCount} root causes; ${item.occurrenceCount} occurrences)`
    ),
    "",
    "## Priority Architectural Root Causes",
    "",
    ...result.rootCauses.slice(0, 20).map((item, index) =>
      `${index + 1}. **${item.severity} — ${item.ruleId} — ${item.ownershipArea}**: ${item.occurrenceCount} occurrence(s), estimated +${item.estimatedScoreGain} score gain`
    ),
    "",
    "## Enforcement Blockers",
    "",
    ...(result.blockingReasons.length ? result.blockingReasons.map((item) => `- ${item}`) : ["- None"]),
    "",
  ];
  return lines.join("\n");
}

function analyze() {
  return evaluate(readJson(graphPath), readJson(rulesPath), listFiles(root));
}

function write(result) {
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(jsonPath, JSON.stringify(result, null, 2) + "\n", "utf8");
  fs.writeFileSync(markdownPath, markdown(result) + "\n", "utf8");
}

function main() {
  const command = process.argv[2] || "help";

  if (command === "analyze") {
    const result = analyze();
    write(result);
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (command === "report") {
    const result = analyze();
    write(result);
    console.log("ATLAS-06B.2 Architectural Root Cause Intelligence complete.");
    console.log(`Status: ${result.status}`);
    console.log(`Score: ${result.score}/100`);
    console.log(`Raw occurrences: ${result.summary.rawOccurrences}`);
    console.log(`Detailed findings: ${result.summary.detailedFindings}`);
    console.log(`Architectural root causes: ${result.summary.architecturalRootCauses}`);
    console.log(`Actionable recommendations: ${result.summary.actionableFindings}`);
    console.log(`Consolidation: ${result.summary.consolidationPercent}%`);
    console.log(`JSON: ${jsonPath}`);
    console.log(`Report: ${markdownPath}`);
    return;
  }

  if (command === "check") {
    const result = analyze();
    write(result);
    console.log(`ATLAS governance status: ${result.status}`);
    console.log(`ATLAS governance score: ${result.score}/100`);
    if (!result.enforceable) {
      result.blockingReasons.forEach((reason) => console.error(`BLOCK: ${reason}`));
      process.exitCode = 2;
    }
    return;
  }

  if (command === "self-test") {
    const synthetic = {
      nodes: [
        { id: "components/review/a.client.tsx", label: "Review Client A", type: "component client", metadata: { file: "components/review/a.client.tsx" }, impact: { score: 95 } },
        { id: "components/review/b.client.tsx", label: "Review Client B", type: "component client", metadata: { file: "components/review/b.client.tsx" }, impact: { score: 80 } },
        { id: "lib/prisma.ts", label: "Prisma", type: "prisma database model", metadata: { file: "lib/prisma.ts" }, impact: { score: 30 } },
        { id: "lib/review/service.ts", label: "Review Service", type: "service", metadata: { file: "lib/review/service.ts" }, impact: { score: 40 } },
      ],
      edges: [
        { source: "components/review/a.client.tsx", target: "lib/prisma.ts", type: "imports" },
        { source: "components/review/b.client.tsx", target: "lib/prisma.ts", type: "imports" },
      ],
      overlays: {
        cycles: [
          ["components/review/a.client.tsx", "lib/review/service.ts"],
          ["components/review/a.client.tsx", "lib/prisma.ts"],
          ["components/review/b.client.tsx", "lib/prisma.ts"],
        ],
      },
    };

    const result = evaluate(
      synthetic,
      readJson(rulesPath),
      ["components/review/a.client.tsx", "components/review/b.client.tsx", "lib/prisma.ts", "docs/architecture.md"],
    );

    if (result.summary.rawOccurrences <= result.summary.architecturalRootCauses) {
      throw new Error("Self-test failed: root-cause consolidation did not occur.");
    }
    if (!result.rootCauses.some((item) => item.occurrenceCount > 1)) {
      throw new Error("Self-test failed: multi-occurrence root cause missing.");
    }
    if (!result.rootCauses.some((item) => item.ownershipArea.includes("components"))) {
      throw new Error("Self-test failed: ownership-area inference missing.");
    }
    if (!result.scoreComponents.length) {
      throw new Error("Self-test failed: weighted score components missing.");
    }

    console.log("ATLAS-06B.2 Architectural Root Cause Intelligence self-test passed.");
    console.log(`Raw occurrences: ${result.summary.rawOccurrences}`);
    console.log(`Detailed findings: ${result.summary.detailedFindings}`);
    console.log(`Architectural root causes: ${result.summary.architecturalRootCauses}`);
    console.log(`Consolidation: ${result.summary.consolidationPercent}%`);
    console.log(`Score: ${result.score}/100`);
    return;
  }

  console.log("ATLAS-06B.2 Architectural Root Cause Intelligence");
  console.log("Commands: analyze | report | check | self-test");
}

module.exports = { analyze, evaluate, markdown };
if (require.main === module) main();
