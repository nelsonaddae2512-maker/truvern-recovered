import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const {
  findVendorFrameworkAssessmentByToken,
  updateTruvernFrameworkAssessment,
  writeGovernanceAuditLog,
} = vi.hoisted(() => ({
  findVendorFrameworkAssessmentByToken:
    vi.fn(),
  updateTruvernFrameworkAssessment:
    vi.fn(),
  writeGovernanceAuditLog:
    vi.fn(),
}));

vi.mock(
  "@/lib/auth/vendor-framework-assessment-token",
  () => ({
    findVendorFrameworkAssessmentByToken,
  }),
);

vi.mock(
  "@/lib/repositories/truvern-framework-assessment-repository",
  () => ({
    updateTruvernFrameworkAssessment,
  }),
);

vi.mock(
  "@/lib/governance/audit-log",
  () => ({
    writeGovernanceAuditLog,
  }),
);

import { POST } from "@/app/api/vendor-framework-assessment/[token]/submit/route";

type MockResponse = {
  id: number;
  answer: unknown;
  metadata: {
    truvernQuestionnaireProjection: {
      applicability: "APPLICABLE";
    };
  };
};

function makeResponses(
  count: number,
  answer: unknown,
): MockResponse[] {
  return Array.from(
    { length: count },
    (_, index) => ({
      id: index + 1,
      answer,
      metadata: {
        truvernQuestionnaireProjection: {
          applicability: "APPLICABLE" as const,
        },
      },
    }),
  );
}

function request(): Request {
  return new Request(
    "https://example.test/api/vendor-framework-assessment/test-token/submit",
    {
      method: "POST",
    },
  );
}

const context = {
  params: Promise.resolve({
    token: "test-token",
  }),
};

describe(
  "vendor framework assessment submission guardrails",
  () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it(
      "rejects submission while any canonical response is incomplete",
      async () => {
        const responses =
          makeResponses(301, "yes");

        responses[300] = {
          ...responses[300],
          answer: null,
        };

        findVendorFrameworkAssessmentByToken
          .mockResolvedValue({
            id: 5001,
            organizationId: 9001,
            frameworkId: 1,
            vendorToken: "test-token",
            submittedAt: null,
            responses,
          });

        const response =
          await POST(request(), context);

        expect(response.status).toBe(303);

        expect(
          response.headers.get("location"),
        ).toContain(
          "submitError=incomplete&missing=1",
        );

        expect(
          updateTruvernFrameworkAssessment,
        ).not.toHaveBeenCalled();

        expect(
          writeGovernanceAuditLog,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      "submits 301 complete canonical responses and writes the submission audit event",
      async () => {
        const responses =
          makeResponses(301, "yes");

        findVendorFrameworkAssessmentByToken
          .mockResolvedValue({
            id: 5001,
            organizationId: 9001,
            frameworkId: 1,
            vendorToken: "test-token",
            submittedAt: null,
            responses,
          });

        updateTruvernFrameworkAssessment
          .mockImplementation(
            async (args: {
              data: {
                status: string;
                submittedAt: Date;
              };
            }) => ({
              id: 5001,
              organizationId: 9001,
              frameworkId: 1,
              status: args.data.status,
              submittedAt:
                args.data.submittedAt,
              responses,
            }),
          );

        const response =
          await POST(request(), context);

        expect(response.status).toBe(303);

        expect(
          response.headers.get("location"),
        ).toContain("submitted=1");

        expect(
          updateTruvernFrameworkAssessment,
        ).toHaveBeenCalledTimes(1);

        const updateCall =
          updateTruvernFrameworkAssessment
            .mock.calls[0]?.[0];

        expect(updateCall).toBeDefined();

        expect(
          updateCall.data.status,
        ).toBe("SUBMITTED");

        expect(
          updateCall.data.submittedAt,
        ).toBeInstanceOf(Date);

        expect(
          writeGovernanceAuditLog,
        ).toHaveBeenCalledTimes(1);

        expect(
          writeGovernanceAuditLog,
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            organizationId: 9001,
            entityId: 5001,
            action:
              "FRAMEWORK_ASSESSMENT_SUBMITTED",
          }),
        );
      },
    );

    it(
      "does not submit an assessment that was already submitted",
      async () => {
        findVendorFrameworkAssessmentByToken
          .mockResolvedValue({
            id: 5001,
            organizationId: 9001,
            frameworkId: 1,
            vendorToken: "test-token",
            submittedAt:
              new Date(
                "2026-01-01T00:00:00.000Z",
              ),
            responses:
              makeResponses(301, "yes"),
          });

        const response =
          await POST(request(), context);

        expect(response.status).toBe(303);

        expect(
          response.headers.get("location"),
        ).toContain("submitted=1");

        expect(
          updateTruvernFrameworkAssessment,
        ).not.toHaveBeenCalled();

        expect(
          writeGovernanceAuditLog,
        ).not.toHaveBeenCalled();
      },
    );
  },
);