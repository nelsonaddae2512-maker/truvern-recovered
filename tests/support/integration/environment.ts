import fs from "node:fs";
import path from "node:path";

const APPROVED_TEST_MARKERS = [
  "test",
  "testing",
  "integration",
  "rs3",
  "ci",
] as const;

const TEST_ENV_FILES = [
  ".env",
  ".env.local",
  ".env.test",
  ".env.test.local",
] as const;

export type IntegrationDatabaseIdentity = {
  protocol: "postgresql:" | "postgres:";
  host: string;
  port: string;
  database: string;
  schema: string;
};

export type IntegrationEnvironment = {
  databaseUrl: string;
  directUrl: string;
  identity: IntegrationDatabaseIdentity;
};

function stripMatchingQuotes(value: string): string {
  const trimmed = value.trim();

  if (trimmed.length < 2) {
    return trimmed;
  }

  const first = trimmed[0];
  const last = trimmed[trimmed.length - 1];

  if (
    (first === `"` && last === `"`) ||
    (first === `'` && last === `'`)
  ) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

function parseEnvironmentLine(
  line: string,
): { key: string; value: string } | null {
  const trimmed = line.trim();

  if (
    trimmed.length === 0 ||
    trimmed.startsWith("#")
  ) {
    return null;
  }

  const normalized = trimmed.startsWith("export ")
    ? trimmed.slice("export ".length).trim()
    : trimmed;

  const separatorIndex = normalized.indexOf("=");

  if (separatorIndex <= 0) {
    return null;
  }

  const key = normalized
    .slice(0, separatorIndex)
    .trim();

  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
    return null;
  }

  const value = stripMatchingQuotes(
    normalized.slice(separatorIndex + 1),
  );

  return {
    key,
    value,
  };
}

function loadEnvironmentFile(filename: string): void {
  const fullPath = path.resolve(
    process.cwd(),
    filename,
  );

  if (!fs.existsSync(fullPath)) {
    return;
  }

  const contents = fs.readFileSync(
    fullPath,
    "utf8",
  );

  for (const line of contents.split(/\r?\n/)) {
    const parsed = parseEnvironmentLine(line);

    if (!parsed) {
      continue;
    }

    if (process.env[parsed.key] === undefined) {
      process.env[parsed.key] = parsed.value;
    }
  }
}

export function loadIntegrationEnvironmentFiles(): void {
  for (const filename of TEST_ENV_FILES) {
    loadEnvironmentFile(filename);
  }
}

function parseDatabaseIdentity(
  rawValue: string,
  variableName: string,
): IntegrationDatabaseIdentity {
  let parsed: URL;

  try {
    parsed = new URL(rawValue);
  } catch {
    throw new Error(
      `${variableName} must be a valid PostgreSQL connection URL.`,
    );
  }

  if (
    parsed.protocol !== "postgresql:" &&
    parsed.protocol !== "postgres:"
  ) {
    throw new Error(
      `${variableName} must use the PostgreSQL protocol.`,
    );
  }

  const database = decodeURIComponent(
    parsed.pathname.replace(/^\/+/, ""),
  )
    .trim()
    .toLowerCase();

  if (!database) {
    throw new Error(
      `${variableName} must identify a dedicated database.`,
    );
  }

  const schema = (
    parsed.searchParams.get("schema") ||
    "public"
  )
    .trim()
    .toLowerCase();

  return {
    protocol: parsed.protocol,
    host: parsed.hostname
      .trim()
      .toLowerCase(),
    port: parsed.port || "5432",
    database,
    schema,
  };
}

function databaseIdentityKey(
  identity: IntegrationDatabaseIdentity,
): string {
  return [
    identity.protocol,
    identity.host,
    identity.port,
    identity.database,
    identity.schema,
  ].join("|");
}

function hasApprovedTestMarker(
  identity: IntegrationDatabaseIdentity,
): boolean {
  const searchable = [
    identity.database,
    identity.schema,
  ].join(" ");

  return APPROVED_TEST_MARKERS.some(
    (marker) => searchable.includes(marker),
  );
}

function assertDedicatedTestIdentity(
  identity: IntegrationDatabaseIdentity,
): void {
  if (!identity.host) {
    throw new Error(
      "TEST_DATABASE_URL must identify a database host.",
    );
  }

  if (!hasApprovedTestMarker(identity)) {
    throw new Error(
      [
        "Unsafe TEST_DATABASE_URL rejected.",
        `Database '${identity.database}' and schema`,
        `'${identity.schema}' do not contain an approved`,
        "test marker.",
        "Use a dedicated name such as 'truvern_test'.",
      ].join(" "),
    );
  }
}

function assertNotOrdinaryDatabase(
  testIdentity: IntegrationDatabaseIdentity,
): void {
  const ordinaryUrl = String(
    process.env.DATABASE_URL || "",
  ).trim();

  if (!ordinaryUrl) {
    return;
  }

  const ordinaryIdentity = parseDatabaseIdentity(
    ordinaryUrl,
    "DATABASE_URL",
  );

  if (
    databaseIdentityKey(testIdentity) ===
    databaseIdentityKey(ordinaryIdentity)
  ) {
    throw new Error(
      [
        "Integration execution refused.",
        "TEST_DATABASE_URL resolves to the same database",
        "and schema as DATABASE_URL.",
      ].join(" "),
    );
  }
}

function assertCompatibleDirectUrl(
  testIdentity: IntegrationDatabaseIdentity,
  directUrl: string,
): void {
  const directIdentity = parseDatabaseIdentity(
    directUrl,
    "TEST_DIRECT_URL",
  );

  const samePhysicalDatabase =
    directIdentity.host === testIdentity.host &&
    directIdentity.port === testIdentity.port &&
    directIdentity.database === testIdentity.database;

  if (!samePhysicalDatabase) {
    throw new Error(
      [
        "TEST_DIRECT_URL must target the same dedicated",
        "test database as TEST_DATABASE_URL.",
      ].join(" "),
    );
  }

  assertDedicatedTestIdentity(directIdentity);
}

export function configureIntegrationEnvironment():
  IntegrationEnvironment {
  loadIntegrationEnvironmentFiles();

  const databaseUrl = String(
    process.env.TEST_DATABASE_URL || "",
  ).trim();

  if (!databaseUrl) {
    throw new Error(
      [
        "TEST_DATABASE_URL is required for database-backed",
        "integration tests.",
        "Create a dedicated PostgreSQL test database, copy",
        ".env.test.example to .env.test.local, and configure",
        "its connection URL.",
        "The ordinary Truvern database will not be used.",
      ].join(" "),
    );
  }

  const identity = parseDatabaseIdentity(
    databaseUrl,
    "TEST_DATABASE_URL",
  );

  assertDedicatedTestIdentity(identity);
  assertNotOrdinaryDatabase(identity);

  const configuredDirectUrl = String(
    process.env.TEST_DIRECT_URL || "",
  ).trim();

  const directUrl =
    configuredDirectUrl || databaseUrl;

  assertCompatibleDirectUrl(
    identity,
    directUrl,
  );

  process.env.DATABASE_URL = databaseUrl;
  process.env.DIRECT_URL = directUrl;
  process.env.TRUVERN_INTEGRATION_TESTS = "1";

  return {
    databaseUrl,
    directUrl,
    identity,
  };
}

export function redactDatabaseIdentity(
  identity: IntegrationDatabaseIdentity,
): IntegrationDatabaseIdentity {
  return {
    protocol: identity.protocol,
    host: identity.host,
    port: identity.port,
    database: identity.database,
    schema: identity.schema,
  };
}