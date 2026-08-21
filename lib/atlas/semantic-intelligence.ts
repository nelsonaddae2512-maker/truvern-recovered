import "server-only";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

export type SemanticRepositoryIntelligence = {
  generatedAt: string;
  schemaVersion: 1;
  engineVersion: "ATLAS-10";
  mode: "ANALYSIS_ONLY";
  summary: {
    filesAnalyzed: number;
    apiRoutes: number;
    pages: number;
    components: number;
    prismaModels: number;
    semanticFeatures: number;
    highPriorityTestTargets: number;
    journeys: number;
  };
  prismaModels: string[];
  features: Array<{
    name: string;
    fileCount: number;
    routeCount: number;
    totalTestPriority: number;
    files: string[];
    routes: Array<{ route: string; methods: string[] }>;
  }>;
  journeys: Array<{
    name: string;
    completeness: number;
    steps: Array<{
      order: number;
      feature: string;
      representativeFiles: string[];
    }>;
  }>;
  highPriorityTests: Array<{
    rank: number;
    file: string;
    semanticArea: string;
    score: number;
    reasons: string[];
    suggestedTestType: string;
    suggestedTestPath: string;
  }>;
};

const root = process.cwd();
const engine = path.join(root, "tools", "atlas", "semantic-intelligence.js");
const output = path.join(root, "tools", "atlas", "output", "semantic-repository-intelligence.json");

export function refreshSemanticRepositoryIntelligence(): SemanticRepositoryIntelligence {
  execFileSync(process.execPath, [engine, "report"], {
    cwd: root,
    stdio: "pipe",
    encoding: "utf8",
    timeout: 240000,
  });
  return getSemanticRepositoryIntelligence();
}

export function getSemanticRepositoryIntelligence(): SemanticRepositoryIntelligence {
  if (!fs.existsSync(output)) return refreshSemanticRepositoryIntelligence();
  return JSON.parse(fs.readFileSync(output, "utf8")) as SemanticRepositoryIntelligence;
}
