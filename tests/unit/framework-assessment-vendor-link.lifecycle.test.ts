import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const mocks = vi.hoisted(() => ({
  findAssessment: vi.fn(),
  findFramework: vi.fn(),
  findVendor: vi.fn(),
  findReviewAssignment: vi.fn(),
  generateToken: vi.fn(),
  sendCommunication: vi.fn(),
  updateMany: vi.fn(),
  findUnique: vi.fn(),
  findFirstConversation: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    truvernFrameworkAssessment: {
      updateMany: mocks.updateMany,
      findUnique: mocks.findUnique,
    },
    communicationConversation: {
      findFirst: mocks.findFirstConversation,
    },
  },
}));

vi.mock(
  "@/lib/auth/vendor-framework-assessment-token",
  () => ({
    generateVendorFrameworkAssessmentToken:
      mocks.generateToken,
  }),
);

vi.mock("@/lib/communications", () => ({
  COMMUNICATION_MAILBOX_KEYS: {
    ASSESSMENTS: "ASSESSMENTS",
  },
  sendCommunication: mocks.sendCommunication,
}));

vi.mock(
  "@/lib/repositories/truvern-framework-repository",
  () => ({
    findTruvernFramework: mocks.findFramework,
  }),
);

vi.mock(
  "@/lib/repositories/truvern-framework-assessment-repository",
  () => ({
    findTruvernFrameworkAssessment:
      mocks.findAssessment,
  }),
);

vi.mock(
  "@/lib/repositories/vendor-repository",
  () => ({
    findVendor: mocks.findVendor,
  }),
);

vi.mock(
  "@/lib/repositories/review-assignment-repository",
  () => ({
    findReviewAssignment:
      mocks.findReviewAssignment,
  }),
);

import {
  sendFrameworkAssessmentVendorLink,
} from "@/lib/communications/framework-assessment-vendor-link";

function assessment(
  status: string,
  vendorToken: string | null = "existing-secure-token",
) {
  return {
    id: 5,
    organizationId: 9,
    vendorId: 22,
    frameworkId: 1,
    reviewAssignmentId: 32,
    assessmentRunId: null,
    title: "Lifecycle regression test",
    status,
    vendorToken,
  };
}

describe(
  "sendFrameworkAssessmentVendorLink lifecycle",
  () => {
    beforeEach(() => {
      vi.clearAllMocks();

      mocks.findFramework.mockResolvedValue({
        name: "Test framework",
        version: "1",
      });

      mocks.findVendor.mockResolvedValue({
        name: "Test Vendor",
        contactEmail: "vendor@example.test",
      });

      mocks.findReviewAssignment.mockResolvedValue({
        id: 32,
        organizationId: 9,
        vendorId: 22,
        reviewRequestId: 44,
      });

      mocks.generateToken.mockReturnValue(
        "generated-secure-token",
      );

      mocks.findFirstConversation.mockResolvedValue(
        null,
      );

      mocks.sendCommunication.mockResolvedValue({
        provider: "test",
        mailboxId: 1,
        conversationId: 2,
        messageId: 3,
        providerMessageId: "provider-message",
        simulated: true,
      });

      mocks.updateMany.mockResolvedValue({
        count: 1,
      });

      mocks.findUnique.mockResolvedValue({
        vendorToken: "generated-secure-token",
      });
    });

    it(
      "marks a DRAFT assessment SENT_TO_VENDOR only after successful delivery",
      async () => {
        mocks.findAssessment.mockResolvedValue(
          assessment("DRAFT"),
        );

        const result =
          await sendFrameworkAssessmentVendorLink({
            assessmentId: 5,
            recipients: [
              "vendor@example.test",
            ],
            mode: "MANUAL_RESEND",
          });

        expect(result.sent).toBe(true);

        expect(
          mocks.sendCommunication,
        ).toHaveBeenCalledTimes(1);

        expect(
          mocks.updateMany,
        ).toHaveBeenCalledTimes(1);

        expect(
          mocks.updateMany,
        ).toHaveBeenCalledWith({
          where: {
            id: 5,
            status: "DRAFT",
          },
          data: {
            status: "SENT_TO_VENDOR",
            sentAt: expect.any(Date),
          },
        });

        expect(
          mocks.sendCommunication.mock
            .invocationCallOrder[0],
        ).toBeLessThan(
          mocks.updateMany.mock
            .invocationCallOrder[0],
        );
      },
    );

    it(
      "cannot regress a later lifecycle state during resend",
      async () => {
        mocks.findAssessment.mockResolvedValue(
          assessment("SUBMITTED"),
        );

        mocks.updateMany.mockResolvedValue({
          count: 0,
        });

        const result =
          await sendFrameworkAssessmentVendorLink({
            assessmentId: 5,
            recipients: [
              "vendor@example.test",
            ],
            mode: "MANUAL_RESEND",
          });

        expect(result.sent).toBe(true);

        expect(
          mocks.updateMany,
        ).toHaveBeenCalledWith({
          where: {
            id: 5,
            status: "DRAFT",
          },
          data: {
            status: "SENT_TO_VENDOR",
            sentAt: expect.any(Date),
          },
        });

        expect(
          mocks.updateMany.mock.results[0]
            ?.value,
        ).resolves.toEqual({
          count: 0,
        });
      },
    );

    it(
      "does not establish sent lifecycle when communication fails",
      async () => {
        mocks.findAssessment.mockResolvedValue(
          assessment("DRAFT"),
        );

        mocks.sendCommunication.mockRejectedValue(
          new Error("simulated delivery failure"),
        );

        await expect(
          sendFrameworkAssessmentVendorLink({
            assessmentId: 5,
            recipients: [
              "vendor@example.test",
            ],
            mode: "MANUAL_RESEND",
          }),
        ).rejects.toThrow(
          "simulated delivery failure",
        );

        expect(
          mocks.updateMany,
        ).not.toHaveBeenCalled();
      },
    );
  },
);
