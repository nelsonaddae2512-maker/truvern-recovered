import fs from "node:fs";
import path from "node:path";

import {
  describe,
  expect,
  it,
} from "vitest";

const root =
  process.cwd();

const route =
  fs.readFileSync(
    path.join(
      root,
      "app/api/review-desk/reviews/[id]/run-ai-remediation/route.ts",
    ),
    "utf8",
  );

const workspace =
  fs.readFileSync(
    path.join(
      root,
      "components/review-desk/review-assignment-workspace.client.tsx",
    ),
    "utf8",
  );

describe(
  "Review Desk AI remediation guardrails",
  () => {
    it(
      "keeps the server action Ops, Truvern-operator, and Truvern-review scoped",
      () => {
        expect(route).toContain(
          '@/lib/auth/truvern-governance',
        );

        expect(route).toContain(
          '@/lib/truvern-ops-access',
        );

        expect(route).toContain(
          "requireReviewerAccess",
        );

        expect(route).toContain(
          "isTruvernOperator",
        );

        expect(route).toContain(
          'actor.role !== "OPS"',
        );

        expect(route).toContain(
          '.toUpperCase() !== "TRUVERN"',
        );
      },
    );

    it(
      "verifies assignment and package ownership before execution",
      () => {
        const ownershipIndex =
          route.indexOf(
            "reviewAssignmentId:",
          );

        const workerIndex =
          route.indexOf(
            "await runAiReviewWorkerForPackage(",
          );

        expect(
          route.indexOf("id: packageId"),
        ).toBeGreaterThan(-1);

        expect(
          ownershipIndex,
        ).toBeGreaterThan(-1);

        expect(
          workerIndex,
        ).toBeGreaterThan(ownershipIndex);

        expect(route).toContain(
          "remediationPackage.evidenceRequestId == null",
        );
      },
    );

    it(
      "uses package-scoped execution only",
      () => {
        expect(route).toContain(
          "runAiReviewWorkerForPackage",
        );

        expect(route).not.toContain(
          "runAiReviewWorker()",
        );

        expect(route).not.toContain(
          "runLockedAiReviewCanary",
        );
      },
    );

    it(
      "renders the action only for Truvern operators with a concrete package",
      () => {
        expect(workspace).toContain(
          "showTruvernOperatorControls",
        );

        expect(workspace).toContain(
          "packageId != null",
        );

        expect(workspace).toContain(
          "Run AI remediation review",
        );

        expect(workspace).toContain(
          "AI output requires human reviewer validation.",
        );
      },
    );

    it(
      "requires explicit reviewer confirmation before POST",
      () => {
        const confirmationIndex =
          workspace.indexOf(
            "window.confirm(",
          );

        const endpointIndex =
          workspace.indexOf(
            "/run-ai-remediation",
          );

        expect(
          confirmationIndex,
        ).toBeGreaterThan(-1);

        expect(
          endpointIndex,
        ).toBeGreaterThan(
          confirmationIndex,
        );

        expect(workspace).toContain(
          "consume the current provider-attempt budget",
        );
      },
    );

    it(
      "posts only the selected package id to the assignment-scoped endpoint",
      () => {
        expect(workspace).toContain(
          '/api/review-desk/reviews/${assignment.id}/run-ai-remediation',
        );

        expect(workspace).toContain(
          "JSON.stringify({",
        );

        expect(workspace).toContain(
          "packageId,",
        );
      },
    );
  },
);
