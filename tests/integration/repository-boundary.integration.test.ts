import {
  describe,
  expect,
  test,
} from "vitest";

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

function walkTypeScriptFiles(root: string): string[] {
  if (!fs.existsSync(root)) {
    return [];
  }

  const files: string[] = [];

  for (const entry of fs.readdirSync(root, {
    withFileTypes: true,
  })) {
    const absolute = path.join(root, entry.name);

    if (entry.isDirectory()) {
      files.push(...walkTypeScriptFiles(absolute));
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    if (!/\.(ts|tsx)$/.test(entry.name)) {
      continue;
    }

    if (/\.bak/i.test(entry.name)) {
      continue;
    }

    if (/corrupted-transcript/i.test(entry.name)) {
      continue;
    }

    files.push(absolute);
  }

  return files;
}

function relative(file: string): string {
  return path
    .relative(ROOT, file)
    .replaceAll("\\", "/");
}

function findMatches(
  files: string[],
  pattern: RegExp,
): Array<{
  file: string;
  line: number;
  text: string;
}> {
  const matches: Array<{
    file: string;
    line: number;
    text: string;
  }> = [];

  for (const file of files) {
    const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);

    for (let i = 0; i < lines.length; i += 1) {
      if (!pattern.test(lines[i])) {
        continue;
      }

      matches.push({
        file: relative(file),
        line: i + 1,
        text: lines[i].trim(),
      });
    }
  }

  return matches;
}

function formatMatches(
  matches: Array<{
    file: string;
    line: number;
    text: string;
  }>,
): string {
  if (!matches.length) {
    return "";
  }

  return [
    "",
    ...matches.map(
      (match) =>
        `${match.file}:${match.line}  ${match.text}`,
    ),
  ].join("\n");
}

describe("RS-20A repository boundary contracts", () => {
  test("live app/api contains no direct Prisma model access", () => {
    const files = walkTypeScriptFiles(
      path.join(ROOT, "app", "api"),
    );

    const matches = findMatches(
      files,
      /\b(?:prisma|tx)\.[A-Za-z0-9_]+\.[A-Za-z0-9_]+/,
    );

    expect(
      matches,
      `Direct Prisma model access returned to app/api:${formatMatches(matches)}`,
    ).toEqual([]);
  });

  test("communications inbound keeps persistence behind repositories while preserving its service transaction", () => {
    const inboundPath = path.join(
      ROOT,
      "lib",
      "communications",
      "inbound.ts",
    );

    expect(
      fs.existsSync(inboundPath),
      "lib/communications/inbound.ts must exist",
    ).toBe(true);

    const source =
      fs.readFileSync(inboundPath, "utf8");

    const directModelMatches =
      source.match(
        /\b(?:prisma|tx)\.[A-Za-z0-9_]+\.[A-Za-z0-9_]+/g,
      ) ?? [];

    expect(
      directModelMatches,
      "Inbound Communications must not perform direct Prisma model operations",
    ).toEqual([]);

    const transactionMatches =
      source.match(
        /prisma\.\$transaction\s*\(\s*async\s*\(\s*tx\s*\)/g,
      ) ?? [];

    expect(
      transactionMatches.length,
      "Inbound Communications must retain exactly one service-owned transaction",
    ).toBe(1);
  });

  test("communications contains no raw Prisma SQL", () => {
    const files = walkTypeScriptFiles(
      path.join(ROOT, "lib", "communications"),
    );

    const matches = findMatches(
      files,
      /\.\$(?:queryRaw|queryRawUnsafe|executeRaw|executeRawUnsafe)/,
    );

    expect(
      matches,
      `Raw Prisma SQL returned to Communications:${formatMatches(matches)}`,
    ).toEqual([]);
  });
});