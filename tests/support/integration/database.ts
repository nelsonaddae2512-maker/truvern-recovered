import { PrismaClient } from "@prisma/client";
import type {
  IntegrationDatabaseIdentity,
} from "./environment";

declare global {
  // eslint-disable-next-line no-var
  var __truvernIntegrationPrisma:
    | PrismaClient
    | undefined;
}

export type ConnectedDatabaseIdentity = {
  database: string;
  schema: string;
  currentUser: string;
};

function createIntegrationPrismaClient(): PrismaClient {
  if (
    process.env.TRUVERN_INTEGRATION_TESTS !== "1"
  ) {
    throw new Error(
      [
        "Integration Prisma client initialization refused.",
        "Call configureIntegrationEnvironment() before",
        "importing or creating the integration database client.",
      ].join(" "),
    );
  }

  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is missing after integration environment configuration.",
    );
  }

  return new PrismaClient({
    log:
      process.env.TRUVERN_INTEGRATION_SQL_LOG === "1"
        ? ["query", "warn", "error"]
        : ["warn", "error"],
  });
}

export function getIntegrationPrisma():
  PrismaClient {
  if (!globalThis.__truvernIntegrationPrisma) {
    globalThis.__truvernIntegrationPrisma =
      createIntegrationPrismaClient();
  }

  return globalThis.__truvernIntegrationPrisma;
}

export async function readConnectedDatabaseIdentity():
  Promise<ConnectedDatabaseIdentity> {
  const prisma = getIntegrationPrisma();

  const rows = await prisma.$queryRaw<
    Array<{
      database: string;
      schema: string;
      currentUser: string;
    }>
  >`
    select
      current_database()::text as "database",
      current_schema()::text as "schema",
      current_user::text as "currentUser"
  `;

  const identity = rows[0];

  if (
    !identity?.database ||
    !identity?.schema ||
    !identity?.currentUser
  ) {
    throw new Error(
      "Unable to resolve the active integration database identity.",
    );
  }

  return identity;
}

export async function verifyIntegrationConnection(
  expected: IntegrationDatabaseIdentity,
): Promise<ConnectedDatabaseIdentity> {
  const connected =
    await readConnectedDatabaseIdentity();

  const expectedDatabase =
    expected.database.trim().toLowerCase();

  const expectedSchema =
    expected.schema.trim().toLowerCase();

  const actualDatabase =
    connected.database.trim().toLowerCase();

  const actualSchema =
    connected.schema.trim().toLowerCase();

  if (
    actualDatabase !== expectedDatabase ||
    actualSchema !== expectedSchema
  ) {
    throw new Error(
      [
        "Integration database identity mismatch.",
        `Expected ${expectedDatabase}/${expectedSchema},`,
        `received ${actualDatabase}/${actualSchema}.`,
        "Execution refused.",
      ].join(" "),
    );
  }

  return connected;
}

export async function connectIntegrationDatabase(
  expected: IntegrationDatabaseIdentity,
): Promise<ConnectedDatabaseIdentity> {
  const prisma = getIntegrationPrisma();

  await prisma.$connect();

  try {
    return await verifyIntegrationConnection(
      expected,
    );
  } catch (error) {
    await prisma.$disconnect();
    globalThis.__truvernIntegrationPrisma =
      undefined;

    throw error;
  }
}

export async function disconnectIntegrationDatabase():
  Promise<void> {
  const prisma =
    globalThis.__truvernIntegrationPrisma;

  if (!prisma) {
    return;
  }

  await prisma.$disconnect();

  globalThis.__truvernIntegrationPrisma =
    undefined;
}