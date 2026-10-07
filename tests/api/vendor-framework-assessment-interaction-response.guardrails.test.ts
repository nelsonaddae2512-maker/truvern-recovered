import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const {
  getAssessmentMock,
  applyInteractionMock,
  updateAssessmentMock,
} = vi.hoisted(() => ({
  getAssessmentMock: vi.fn(),
  applyInteractionMock: vi.fn(),
  updateAssessmentMock: vi.fn(),
}));

vi.mock(
  "@/lib/auth/vendor-framework-assessment-token",
  () => ({
    findVendorFrameworkAssessmentByToken:
      getAssessmentMock,
  }),
);

vi.mock(
  "@/lib/services/truvern-vendor-interaction-response-service",
  () => ({
    applyTruvernVendorInteractionResponse:
      applyInteractionMock,
  }),
);

vi.mock(
  "@/lib/repositories/truvern-framework-assessment-repository",
  () => ({
    updateTruvernFrameworkAssessment:
      updateAssessmentMock,
  }),
);

import {
  POST,
} from "@/app/api/vendor-framework-assessment/[token]/interaction-response/route";

function context(
  token = "test-token",
) {
  return {
    params: Promise.resolve({
      token,
    }),
  };
}

function request(
  body: unknown,
) {
  return new Request(
    "http://localhost/api/vendor-framework-assessment/test-token/interaction-response",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );
}

const validBody = {
  interactionId: "TRV-Q7R1-001",
  sharedAnswer: "no",
  components: [
    {
      responseId: 1205,
      questionId: 1,
      componentId:
        "TRV-Q7R1-001-C01",
      mode: "CONFIRMED",
      answer: "no",
    },
  ],
};

describe(
  "vendor framework interaction response route guardrails",
  () => {
    beforeEach(() => {
      vi.clearAllMocks();

      getAssessmentMock.mockResolvedValue({
        id: 5,
        submittedAt: null,
        responses: [
          {
            id: 1205,
            questionId: 9001,
            question: {
              control: {
                controlId: "AC-1",
              },
            },
          },
        ],
      });

      applyInteractionMock.mockResolvedValue({
        updated: 1,
      });

      updateAssessmentMock.mockResolvedValue({
        id: 5,
      });
    });

    it(
      "derives assessmentId and confirmedAt server-side",
      async () => {
        const response =
          await POST(
            request({
              ...validBody,
              assessmentId: 999999,
              confirmedAt:
                "1900-01-01T00:00:00.000Z",
            }),
            context(),
          );

        expect(response.status).toBe(200);

        expect(
          applyInteractionMock,
        ).toHaveBeenCalledTimes(1);

        const input =
          applyInteractionMock.mock.calls[0][0];

        expect(input.assessmentId).toBe(5);

        expect(input.confirmedAt).not.toBe(
          "1900-01-01T00:00:00.000Z",
        );

        expect(
          Number.isNaN(
            Date.parse(input.confirmedAt),
          ),
        ).toBe(false);

        expect(
          input.components[0].responseId,
        ).toBe(1205);

        expect(
          input.components[0].persistedQuestionId,
        ).toBe(9001);

        expect(
          input.components[0].canonicalControlId,
        ).toBe("AC-1");

        expect(
          input.components[0],
        ).not.toHaveProperty(
          "questionId",
        );

        expect(
          updateAssessmentMock,
        ).toHaveBeenCalledTimes(1);
      },
    );

    it(
      "returns 404 when the token does not resolve an assessment",
      async () => {
        getAssessmentMock.mockResolvedValue(
          null,
        );

        const response =
          await POST(
            request(validBody),
            context(),
          );

        expect(response.status).toBe(404);

        expect(
          applyInteractionMock,
        ).not.toHaveBeenCalled();

        expect(
          updateAssessmentMock,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      "returns 409 for an already submitted assessment",
      async () => {
        getAssessmentMock.mockResolvedValue({
          id: 5,
          submittedAt:
            new Date(
              "2026-10-07T00:00:00.000Z",
            ),
        responses: [],
        });

        const response =
          await POST(
            request(validBody),
            context(),
          );

        expect(response.status).toBe(409);

        expect(
          applyInteractionMock,
        ).not.toHaveBeenCalled();

        expect(
          updateAssessmentMock,
        ).not.toHaveBeenCalled();
      },
    );


    it(
      "rejects a response outside the token-authorized assessment before invoking the service",
      async () => {
        const response =
          await POST(
            request({
              ...validBody,
              components: [
                {
                  ...validBody.components[0],
                  responseId: 999999,
                },
              ],
            }),
            context(),
          );

        expect(response.status).toBe(404);

        expect(
          applyInteractionMock,
        ).not.toHaveBeenCalled();

        expect(
          updateAssessmentMock,
        ).not.toHaveBeenCalled();

        await expect(
          response.json(),
        ).resolves.toEqual({
          error:
            "Canonical response does not belong to the token-authorized assessment.",
        });
      },
    );
    it(
      "rejects malformed component input before invoking the service",
      async () => {
        const response =
          await POST(
            request({
              interactionId:
                "TRV-Q7R1-001",
              sharedAnswer: "no",
              components: [],
            }),
            context(),
          );

        expect(response.status).toBe(400);

        expect(
          applyInteractionMock,
        ).not.toHaveBeenCalled();

        expect(
          updateAssessmentMock,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      "maps canonical ownership failure to 404 and does not update assessment status",
      async () => {
        applyInteractionMock.mockRejectedValue(
          new Error(
            "Canonical response does not belong to the assessment and question supplied.",
          ),
        );

        const response =
          await POST(
            request(validBody),
            context(),
          );

        expect(response.status).toBe(404);

        expect(
          updateAssessmentMock,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      "maps certified projection failure to 400 and does not update assessment status",
      async () => {
        applyInteractionMock.mockRejectedValue(
          new Error(
            "Interaction is not present in the certified questionnaire projection.",
          ),
        );

        const response =
          await POST(
            request(validBody),
            context(),
          );

        expect(response.status).toBe(400);

        expect(
          updateAssessmentMock,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      "preserves VENDOR_IN_PROGRESS after a successful interaction write",
      async () => {
        const response =
          await POST(
            request(validBody),
            context(),
          );

        expect(response.status).toBe(200);

        expect(
          updateAssessmentMock,
        ).toHaveBeenCalledWith({
          where: {
            id: 5,
          },
          data: {
            status:
              "VENDOR_IN_PROGRESS",
          },
        });
      },
    );

    it(
      "does not change assessment status when the interaction service fails",
      async () => {
        applyInteractionMock.mockRejectedValue(
          new Error(
            "synthetic canonical write failure",
          ),
        );

        const response =
          await POST(
            request(validBody),
            context(),
          );

        expect(response.status).toBe(500);

        expect(
          updateAssessmentMock,
        ).not.toHaveBeenCalled();
      },
    );
  },
);
