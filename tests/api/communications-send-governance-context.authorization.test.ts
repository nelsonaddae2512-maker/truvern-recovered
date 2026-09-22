import fs from "node:fs";
import path from "node:path";

import {
  describe,
  expect,
  it,
} from "vitest";

const routePath =
  path.join(
    process.cwd(),
    "app",
    "api",
    "communications",
    "send",
    "route.ts",
  );

const source =
  fs.readFileSync(
    routePath,
    "utf8",
  );

const governanceFields = [
  "vendorId",
  "assessmentId",
  "assessmentRunId",
  "reviewRequestId",
  "reviewAssignmentId",
  "evidenceRequestId",
] as const;

describe(
  "communications send governance context authority",
  () => {
    it(
      "does not accept caller-controlled governance identifiers",
      () => {
        for (const field of governanceFields) {
          expect(source).not.toContain(
            `${field}?: unknown`,
          );
        }
      },
    );

    it(
      "does not forward caller-controlled governance identifiers",
      () => {
        for (const field of governanceFields) {
          expect(source).not.toContain(
            `body.${field}`,
          );
        }
      },
    );

    it(
      "keeps organization authority server-derived",
      () => {
        expect(source).toContain(
          "context: {",
        );

        expect(source).toContain(
          "organizationId:",
        );

        expect(source).toContain(
          "gate.organizationId",
        );
      },
    );

    it(
      "preserves the trusted communications service boundary",
      () => {
        expect(source).toContain(
          "await sendCommunication({",
        );

        expect(source).toContain(
          "mailboxId:",
        );

        expect(source).toContain(
          "mailbox.id",
        );
      },
    );
  },
);
