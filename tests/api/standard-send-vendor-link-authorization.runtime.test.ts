import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  requireDbOrganization: vi.fn(),
  getGovernanceActor: vi.fn(),
  requireGovernanceCapability: vi.fn(),
  governanceAuthErrorResponse: vi.fn(),
  findAssessment: vi.fn(),
  sendAssessmentVendorLink: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({
  auth: mocks.auth,
}));

vi.mock("@/lib/org-db", () => ({
  requireDbOrganization:
    mocks.requireDbOrganization,
}));

vi.mock("@/lib/auth/truvern-governance", () => ({
  getGovernanceActor:
    mocks.getGovernanceActor,
  requireGovernanceCapability:
    mocks.requireGovernanceCapability,
}));

vi.mock("@/lib/auth/governance-auth-errors", () => ({
  governanceAuthErrorResponse:
    mocks.governanceAuthErrorResponse,
}));

vi.mock("@/lib/repositories/assessment-repository", () => ({
  findAssessment:
    mocks.findAssessment,
}));

vi.mock("@/lib/communications/assessment-vendor-link", () => ({
  sendAssessmentVendorLink:
    mocks.sendAssessmentVendorLink,
}));

import { POST } from "../../app/api/assessments/[id]/send-vendor-link/route";

function request() {
  return new Request(
    "http://localhost/test",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        recipients: [
          "vendor@example.com",
        ],
      }),
    },
  );
}

function params() {
  return {
    params: Promise.resolve({
      id: "41",
    }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();

  mocks.auth.mockResolvedValue({
    userId: "user_1",
  });

  mocks.requireDbOrganization.mockResolvedValue({
    id: 7,
  });

  mocks.getGovernanceActor.mockResolvedValue({
    userId: "user_1",
    organizationId: 7,
    vendorId: null,
    role: "ANALYST",
  });

  mocks.requireGovernanceCapability
    .mockReturnValue(undefined);

  mocks.governanceAuthErrorResponse
    .mockReturnValue(null);

  mocks.findAssessment.mockResolvedValue({
    id: 41,
    organizationId: 7,
  });

  mocks.sendAssessmentVendorLink
    .mockResolvedValue({
      sent: true,
      alreadySent: false,
      mailboxId: 1,
      conversationId: 2,
      messageId: 3,
      providerMessageId: "provider_1",
      simulated: false,
    });
});

describe(
  "standard send-vendor-link authorization",
  () => {
    it(
      "requires assessment.manage before assessment lookup or send",
      async () => {
        const response =
          await POST(
            request(),
            params(),
          );

        expect(response.status)
          .toBe(200);

        expect(
          mocks.requireGovernanceCapability,
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            organizationId: 7,
          }),
          "assessment.manage",
        );

        expect(
          mocks.requireGovernanceCapability
            .mock.invocationCallOrder[0],
        ).toBeLessThan(
          mocks.findAssessment
            .mock.invocationCallOrder[0],
        );

        expect(
          mocks.findAssessment
            .mock.invocationCallOrder[0],
        ).toBeLessThan(
          mocks.sendAssessmentVendorLink
            .mock.invocationCallOrder[0],
        );
      },
    );

    it(
      "maps capability denial and stops before assessment lookup or send",
      async () => {
        const denied =
          new Error("forbidden");

        mocks.requireGovernanceCapability
          .mockImplementation(() => {
            throw denied;
          });

        mocks.governanceAuthErrorResponse
          .mockImplementation((error) =>
            error === denied
              ? Response.json(
                  {
                    ok: false,
                    error: "Forbidden.",
                  },
                  {
                    status: 403,
                  },
                )
              : null,
          );

        const response =
          await POST(
            request(),
            params(),
          );

        expect(response.status)
          .toBe(403);

        expect(mocks.findAssessment)
          .not.toHaveBeenCalled();

        expect(
          mocks.sendAssessmentVendorLink,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      "rejects an assessment outside the authenticated organization",
      async () => {
        mocks.findAssessment.mockResolvedValue({
          id: 41,
          organizationId: 99,
        });

        const response =
          await POST(
            request(),
            params(),
          );

        expect(response.status)
          .toBe(404);

        expect(
          mocks.sendAssessmentVendorLink,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      "sends only after capability and tenant authorization",
      async () => {
        const response =
          await POST(
            request(),
            params(),
          );

        expect(response.status)
          .toBe(200);

        expect(
          mocks.sendAssessmentVendorLink,
        ).toHaveBeenCalledWith({
          assessmentId: 41,
          recipients: [
            "vendor@example.com",
          ],
          mode: "MANUAL_RESEND",
        });
      },
    );
  },
);