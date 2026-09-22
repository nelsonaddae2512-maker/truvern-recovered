import fs from "node:fs";
import path from "node:path";

import {
  describe,
  expect,
  it,
} from "vitest";

const repoRoot = process.cwd();

function read(relativePath: string): string {
  return fs.readFileSync(
    path.join(repoRoot, relativePath),
    "utf8",
  );
}

const accessPath =
  "lib/truvern-ops-access.ts";

const routePaths = [
  "app/api/truvern/ops/deployment-licenses/[id]/expiration/route.ts",
  "app/api/truvern/ops/deployment-licenses/[id]/reactivate/route.ts",
  "app/api/truvern/ops/deployment-licenses/[id]/revoke/route.ts",
  "app/api/truvern/ops/deployment-licenses/[id]/rotate/route.ts",
  "app/api/truvern/ops/deployment-licenses/[id]/route.ts",
  "app/api/truvern/ops/deployment-licenses/[id]/suspend/route.ts",
  "app/api/truvern/ops/deployment-licenses/route.ts",
];

describe(
  "deployment-license Ops authorization boundary",
  () => {
    it(
      "derives global operator roles only from backend-controlled private metadata",
      () => {
        const source = read(accessPath);

        expect(source).toContain(
          "const roles = collectRoles(privateMetadata);",
        );

        expect(source).not.toContain(
          "collectRoles(session.sessionClaims",
        );

        expect(source).not.toContain(
          "user.publicMetadata",
        );

        expect(source).not.toContain(
          "user.unsafeMetadata",
        );
      },
    );

    it(
      "fails closed when no authenticated Clerk user exists",
      () => {
        const source = read(accessPath);

        expect(source).toContain(
          "if (!userId)",
        );

        expect(source).toContain(
          "isTruvernOperator: false",
        );
      },
    );

    it(
      "rejects callers that are not Truvern operators",
      () => {
        const source = read(accessPath);

        expect(source).toContain(
          "if (!access.isTruvernOperator)",
        );

        expect(source).toContain(
          'redirect("/")',
        );
      },
    );

    it(
      "keeps every deployment-license HTTP route behind the operator gate",
      () => {
        expect(routePaths).toHaveLength(7);

        for (const routePath of routePaths) {
          const source = read(routePath);

          expect(
            source,
            routePath,
          ).toContain(
            "requireTruvernOperator",
          );
        }
      },
    );
  },
);