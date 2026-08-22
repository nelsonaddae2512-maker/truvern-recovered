import {
  describe,
  expect,
  it,
} from "vitest";

import fs from "node:fs";
import path from "node:path";

describe(
  "RC40L assessment submission communications",
  () => {
    const route =
      fs.readFileSync(
        path.join(
          process.cwd(),
          "app",
          "vendor-portal",
          "assessment-submit",
          "route.ts",
        ),
        "utf8",
      );

    const lifecycle =
      fs.readFileSync(
        path.join(
          process.cwd(),
          "lib",
          "communications",
          "assessment-lifecycle.ts",
        ),
        "utf8",
      );

    it(
      "records the lifecycle event only on first submission",
      () => {
        expect(route).toContain(
          "if (!result.alreadySubmitted)",
        );

        const firstSubmission =
          route.indexOf(
            "if (!result.alreadySubmitted)",
          );

        const lifecycleCall =
          route.indexOf(
            "recordAssessmentSubmissionCommunication({",
          );

        expect(lifecycleCall).toBeGreaterThan(
          firstSubmission,
        );
      },
    );

    it(
      "reuses the deterministic assessment communications thread",
      () => {
        expect(lifecycle).toContain(
          "`assessment:${input.assessmentId}:vendor-link`",
        );

        expect(lifecycle).toContain(
          "assessmentId:",
        );

        expect(lifecycle).toContain(
          "externalThreadId",
        );
      },
    );

    it(
      "records an internal system event without sending email",
      () => {
        expect(lifecycle).toContain(
          'direction: "INTERNAL"',
        );

        expect(lifecycle).toContain(
          'channel: "SYSTEM"',
        );

        expect(lifecycle).toContain(
          'status: "RECEIVED"',
        );

        expect(lifecycle).not.toContain(
          "sendCommunication(",
        );

        expect(lifecycle).not.toContain(
          "Resend",
        );
      },
    );

    it(
      "touches the existing conversation timeline",
      () => {
        expect(lifecycle).toContain(
          "updateCommunicationConversation({",
        );

        expect(lifecycle).toContain(
          "lastMessageAt:",
        );
      },
    );

    it(
      "does not manufacture an orphan conversation",
      () => {
        expect(lifecycle).toContain(
          "if (!conversation)",
        );

        expect(lifecycle).not.toContain(
          "createCommunicationConversation(",
        );
      },
    );

    it(
      "keeps duplicate submission events guarded",
      () => {
        expect(lifecycle).toContain(
          'subject:',
        );

        expect(lifecycle).toContain(
          '"Vendor assessment submitted"',
        );

        expect(lifecycle).toContain(
          'direction: "INTERNAL"',
        );
      },
    );
  },
);
