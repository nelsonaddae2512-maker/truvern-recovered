const fs = require("fs");
const path = require("path");

const root = process.cwd();
const schemaPath = path.join(root, "prisma", "schema.prisma");

if (!fs.existsSync(schemaPath)) {
  console.error(`Prisma schema not found: ${schemaPath}`);
  process.exit(1);
}

const source = fs.readFileSync(schemaPath, "utf8");

function stripInlineComment(line) {
  let inString = false;
  let escaped = false;
  for (let i = 0; i < line.length - 1; i++) {
    const ch = line[i];
    const next = line[i + 1];
    if (ch === "\\" && !escaped) {
      escaped = true;
      continue;
    }
    if (ch === '"' && !escaped) inString = !inString;
    escaped = false;
    if (!inString && ch === "/" && next === "/") {
      return line.slice(0, i);
    }
  }
  return line;
}

function splitTopLevel(input) {
  const parts = [];
  let current = "";
  let paren = 0;
  let bracket = 0;
  let inString = false;
  let escaped = false;

  for (const ch of input) {
    if (ch === "\\" && !escaped) {
      current += ch;
      escaped = true;
      continue;
    }
    if (ch === '"' && !escaped) inString = !inString;
    escaped = false;

    if (!inString) {
      if (ch === "(") paren++;
      if (ch === ")") paren--;
      if (ch === "[") bracket++;
      if (ch === "]") bracket--;
      if (/\s/.test(ch) && paren === 0 && bracket === 0) {
        if (current.trim()) {
          parts.push(current.trim());
          current = "";
        }
        continue;
      }
    }
    current += ch;
  }

  if (current.trim()) parts.push(current.trim());
  return parts;
}

function parseAttributes(tokens) {
  const attributes = [];
  for (const token of tokens) {
    if (!token.startsWith("@")) continue;
    const match = token.match(/^(@@?[A-Za-z0-9_]+)(?:\((.*)\))?$/s);
    if (match) {
      attributes.push({
        name: match[1],
        arguments: match[2] || null,
        raw: token,
      });
    } else {
      attributes.push({ name: token, arguments: null, raw: token });
    }
  }
  return attributes;
}

function parseBlocks(kind) {
  const re = new RegExp(`\\b${kind}\\s+([A-Za-z_][A-Za-z0-9_]*)\\s*\\{`, "g");
  const blocks = [];
  let match;
  while ((match = re.exec(source))) {
    const name = match[1];
    let i = re.lastIndex;
    let depth = 1;
    let inString = false;
    let escaped = false;

    while (i < source.length && depth > 0) {
      const ch = source[i];
      if (ch === "\\" && !escaped) {
        escaped = true;
        i++;
        continue;
      }
      if (ch === '"' && !escaped) inString = !inString;
      escaped = false;
      if (!inString) {
        if (ch === "{") depth++;
        if (ch === "}") depth--;
      }
      i++;
    }

    blocks.push({
      name,
      body: source.slice(re.lastIndex, i - 1),
      start: match.index,
      end: i,
    });
    re.lastIndex = i;
  }
  return blocks;
}

const enumBlocks = parseBlocks("enum");
const enums = enumBlocks.map((block) => {
  const values = [];
  for (const rawLine of block.body.split(/\r?\n/)) {
    const line = stripInlineComment(rawLine).trim();
    if (!line || line.startsWith("///")) continue;
    const parts = splitTopLevel(line);
    if (!parts.length) continue;
    const value = parts[0];
    if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
      values.push({
        name: value,
        attributes: parseAttributes(parts.slice(1)),
      });
    }
  }
  return { name: block.name, values };
});

const enumNames = new Set(enums.map((item) => item.name));
const scalarTypes = new Set([
  "String", "Boolean", "Int", "BigInt", "Float", "Decimal",
  "DateTime", "Json", "Bytes", "Unsupported"
]);

const modelBlocks = parseBlocks("model");
const models = modelBlocks.map((block) => {
  const fields = [];
  const modelAttributes = [];

  for (const rawLine of block.body.split(/\r?\n/)) {
    const line = stripInlineComment(rawLine).trim();
    if (!line || line.startsWith("///")) continue;

    if (line.startsWith("@@")) {
      const attrs = parseAttributes([line]);
      modelAttributes.push(...attrs);
      continue;
    }

    const parts = splitTopLevel(line);
    if (parts.length < 2) continue;

    const fieldName = parts[0];
    const rawType = parts[1];
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(fieldName)) continue;

    const isList = rawType.endsWith("[]");
    const isOptional = rawType.endsWith("?");
    const baseType = rawType.replace(/\[\]$/, "").replace(/\?$/, "");
    const attributes = parseAttributes(parts.slice(2));

    const relationAttr = attributes.find((a) => a.name === "@relation");
    const defaultAttr = attributes.find((a) => a.name === "@default");
    const mapAttr = attributes.find((a) => a.name === "@map");

    fields.push({
      name: fieldName,
      type: baseType,
      rawType,
      isOptional,
      isList,
      category: scalarTypes.has(baseType)
        ? "scalar"
        : enumNames.has(baseType)
          ? "enum"
          : "relation",
      isId: attributes.some((a) => a.name === "@id"),
      isUnique: attributes.some((a) => a.name === "@unique"),
      isUpdatedAt: attributes.some((a) => a.name === "@updatedAt"),
      default: defaultAttr ? defaultAttr.arguments : null,
      mappedName: mapAttr ? mapAttr.arguments : null,
      relation: relationAttr ? relationAttr.arguments : null,
      attributes,
    });
  }

  return {
    name: block.name,
    fields,
    attributes: modelAttributes,
    ids: fields.filter((f) => f.isId).map((f) => f.name),
    uniqueFields: fields.filter((f) => f.isUnique).map((f) => f.name),
    indexes: modelAttributes.filter((a) => a.name === "@@index"),
    uniqueConstraints: modelAttributes.filter((a) => a.name === "@@unique"),
    mappedName: (modelAttributes.find((a) => a.name === "@@map") || {}).arguments || null,
  };
});

const manifest = {
  generatedAt: new Date().toISOString(),
  schemaPath: path.relative(root, schemaPath).replace(/\\/g, "/"),
  summary: {
    models: models.length,
    enums: enums.length,
    fields: models.reduce((sum, model) => sum + model.fields.length, 0),
    relations: models.reduce(
      (sum, model) => sum + model.fields.filter((field) => field.category === "relation").length,
      0
    ),
    indexes: models.reduce((sum, model) => sum + model.indexes.length, 0),
    uniqueConstraints: models.reduce((sum, model) => sum + model.uniqueConstraints.length, 0),
  },
  models,
  enums,
};

function esc(value) {
  return String(value ?? "")
    .replace(/\|/g, "\\|")
    .replace(/\r?\n/g, " ");
}

function modelSection(model) {
  const lines = [];
  lines.push(`## ${model.name}`);
  lines.push("");
  lines.push(`- Fields: ${model.fields.length}`);
  lines.push(`- Relations: ${model.fields.filter((f) => f.category === "relation").length}`);
  lines.push(`- Primary identifier fields: ${model.ids.length ? model.ids.join(", ") : "None detected"}`);
  lines.push(`- Mapped table name: ${model.mappedName || "Default Prisma mapping"}`);
  lines.push("");
  lines.push("| Field | Type | Category | Optional | List | ID | Unique | Default | Relation |");
  lines.push("|---|---|---|---:|---:|---:|---:|---|---|");
  for (const field of model.fields) {
    lines.push(
      `| ${esc(field.name)} | ${esc(field.rawType)} | ${esc(field.category)} | ` +
      `${field.isOptional ? "Yes" : "No"} | ${field.isList ? "Yes" : "No"} | ` +
      `${field.isId ? "Yes" : "No"} | ${field.isUnique ? "Yes" : "No"} | ` +
      `${esc(field.default || "")} | ${esc(field.relation || "")} |`
    );
  }
  lines.push("");

  if (model.attributes.length) {
    lines.push("### Model attributes");
    lines.push("");
    for (const attr of model.attributes) {
      lines.push(`- \`${attr.raw}\``);
    }
    lines.push("");
  }

  return lines.join("\n");
}

const registry = [
  "# Generated Database Registry",
  "",
  "> Generated by ATLAS-02B. Do not hand-edit this file; update `prisma/schema.prisma` and rerun `pnpm atlas:database`.",
  "",
  `Generated: ${manifest.generatedAt}`,
  "",
  "## Summary",
  "",
  `- Models: ${manifest.summary.models}`,
  `- Enums: ${manifest.summary.enums}`,
  `- Fields: ${manifest.summary.fields}`,
  `- Relations: ${manifest.summary.relations}`,
  `- Indexes: ${manifest.summary.indexes}`,
  `- Compound unique constraints: ${manifest.summary.uniqueConstraints}`,
  "",
  "## Models",
  "",
  ...models.map(modelSection),
  "## Enums",
  "",
  ...enums.flatMap((item) => [
    `### ${item.name}`,
    "",
    ...(item.values.length ? item.values.map((value) => `- \`${value.name}\``) : ["- No values detected"]),
    "",
  ]),
  "",
].join("\n");

const report = [
  "# ATLAS Database Intelligence Report",
  "",
  `Generated from \`${manifest.schemaPath}\` at ${manifest.generatedAt}.`,
  "",
  "## Inventory totals",
  "",
  "| Metric | Count |",
  "|---|---:|",
  `| Models | ${manifest.summary.models} |`,
  `| Enums | ${manifest.summary.enums} |`,
  `| Fields | ${manifest.summary.fields} |`,
  `| Relations | ${manifest.summary.relations} |`,
  `| Indexes | ${manifest.summary.indexes} |`,
  `| Compound unique constraints | ${manifest.summary.uniqueConstraints} |`,
  "",
  "## Model overview",
  "",
  "| Model | Fields | Relations | IDs | Unique fields | Indexes |",
  "|---|---:|---:|---|---|---:|",
  ...models.map((model) =>
    `| ${esc(model.name)} | ${model.fields.length} | ` +
    `${model.fields.filter((f) => f.category === "relation").length} | ` +
    `${esc(model.ids.join(", ") || "—")} | ${esc(model.uniqueFields.join(", ") || "—")} | ` +
    `${model.indexes.length} |`
  ),
  "",
  "## Notes",
  "",
  "- This scanner is deterministic and dependency-free.",
  "- It inventories declared Prisma schema structure; it does not connect to the production database.",
  "- Relation ownership and business-domain ownership remain governance annotations for a later ATLAS milestone.",
  "",
].join("\n");

const outputDir = path.join(root, "tools", "atlas", "output");
const governanceDir = path.join(root, "governance");
const reportsDir = path.join(root, "docs", "reports");

fs.mkdirSync(outputDir, { recursive: true });
fs.mkdirSync(governanceDir, { recursive: true });
fs.mkdirSync(reportsDir, { recursive: true });

fs.writeFileSync(
  path.join(outputDir, "database-manifest.json"),
  JSON.stringify(manifest, null, 2) + "\n",
  "utf8"
);
fs.writeFileSync(
  path.join(governanceDir, "DATABASE_REGISTRY.generated.md"),
  registry,
  "utf8"
);
fs.writeFileSync(
  path.join(reportsDir, "ATLAS-DATABASE-INTELLIGENCE.md"),
  report,
  "utf8"
);

console.log("ATLAS-02B Prisma intelligence complete.");
console.log(`Models: ${manifest.summary.models}`);
console.log(`Enums: ${manifest.summary.enums}`);
console.log(`Fields: ${manifest.summary.fields}`);
console.log(`Relations: ${manifest.summary.relations}`);
console.log("Manifest: tools/atlas/output/database-manifest.json");
console.log("Registry: governance/DATABASE_REGISTRY.generated.md");
console.log("Report: docs/reports/ATLAS-DATABASE-INTELLIGENCE.md");
