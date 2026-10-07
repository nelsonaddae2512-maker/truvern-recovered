import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const {
  transactionMock,
  findResponseMock,
  updateResponseMock,
} = vi.hoisted(() => ({
  transactionMock: vi.fn(),
  findResponseMock: vi.fn(),
  updateResponseMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    $transaction: transactionMock,
  },
}));

vi.mock(
  "@/lib/repositories/truvern-assessment-response-repository",
  () => ({
    findFirstTruvernAssessmentResponse:
      findResponseMock,
    updateTruvernAssessmentResponse:
      updateResponseMock,
  }),
);

import {
  applyTruvernVendorInteractionResponse,
} from "@/lib/services/truvern-vendor-interaction-response-service";

const interactionId =
  "TRV-Q7R1-001";

const componentOne = {
  responseId: 1205,
  questionId: 1,
  componentId: "TRV-Q7R1-001-C01",
  mode: "CONFIRMED" as const,
  answer: "no",
};

const componentTwo = {
  responseId: 1228,
  questionId: 24,
  componentId: "TRV-Q7R1-001-C02",
  mode: "OVERRIDE" as const,
  answer: "yes",
};

describe(
  "Truvern vendor interaction response service",
  () => {
    beforeEach(() => {
      vi.clearAllMocks();

      transactionMock.mockImplementation(
        async (
          callback: (
            tx: Record<string, unknown>,
          ) => Promise<unknown>,
        ) => {
          return callback({
            transactionMarker: true,
          });
        },
      );

      findResponseMock.mockImplementation(
        async (
          args: {
            where: {
              id: number;
              assessmentId: number;
              questionId: number;
            };
          },
          client: unknown,
        ) => ({
          id: args.where.id,
          assessmentId:
            args.where.assessmentId,
          questionId:
            args.where.questionId,
          metadata:
            args.where.id === 1205
              ? {
                  truvernQuestionnaireProjection: {
                    preserveMe: true,
                  },
                }
              : {
                  unrelated: {
                    preserveMe: true,
                  },
                },
          client,
        }),
      );

      updateResponseMock.mockImplementation(
        async (
          args: {
            where: {
              id: number;
              assessmentId: number;
            };
            data: {
              answer: unknown;
              metadata: unknown;
            };
          },
          client: unknown,
        ) => ({
          id: args.where.id,
          assessmentId:
            args.where.assessmentId,
          answer:
            args.data.answer,
          metadata:
            args.data.metadata,
          client,
        }),
      );
    });

    it(
      "preflights ownership then persists canonical responses in one transaction",
      async () => {
        const result =
          await applyTruvernVendorInteractionResponse({
            assessmentId: 5,
            interactionId,
            sharedAnswer: "no",
            confirmedAt:
              "2026-10-07T00:00:00.000Z",
            components: [
              componentOne,
              componentTwo,
            ],
          });

        expect(transactionMock).toHaveBeenCalledTimes(1);

        expect(findResponseMock).toHaveBeenCalledTimes(2);
        expect(updateResponseMock).toHaveBeenCalledTimes(2);

        expect(
          findResponseMock.mock.calls[0]?.[0],
        ).toMatchObject({
          where: {
            id: 1205,
            assessmentId: 5,
            questionId: 1,
          },
          select: {
            id: true,
            assessmentId: true,
            questionId: true,
            metadata: true,
          },
        });

        expect(
          findResponseMock.mock.calls[1]?.[0],
        ).toMatchObject({
          where: {
            id: 1228,
            assessmentId: 5,
            questionId: 24,
          },
        });

        expect(
          findResponseMock.mock.calls[0]?.[1],
        ).toEqual({
          transactionMarker: true,
        });

        expect(
          updateResponseMock.mock.calls[0]?.[1],
        ).toEqual({
          transactionMarker: true,
        });

        expect(
          updateResponseMock.mock.calls[0]?.[0],
        ).toMatchObject({
          where: {
            id: 1205,
            assessmentId: 5,
          },
          data: {
            answer: "no",
            metadata: {
              truvernQuestionnaireProjection: {
                preserveMe: true,
              },
              truvernVendorInteractionResponse: {
                version: 1,
                interactionId,
                componentId:
                  "TRV-Q7R1-001-C01",
                mode: "CONFIRMED",
                sharedAnswer: "no",
                confirmedAt:
                  "2026-10-07T00:00:00.000Z",
              },
            },
          },
        });

        expect(
          updateResponseMock.mock.calls[1]?.[0],
        ).toMatchObject({
          where: {
            id: 1228,
            assessmentId: 5,
          },
          data: {
            answer: "yes",
            metadata: {
              unrelated: {
                preserveMe: true,
              },
              truvernVendorInteractionResponse: {
                version: 1,
                interactionId,
                componentId:
                  "TRV-Q7R1-001-C02",
                mode: "OVERRIDE",
                sharedAnswer: "no",
                confirmedAt:
                  "2026-10-07T00:00:00.000Z",
              },
            },
          },
        });

        expect(result.responses).toHaveLength(2);
      },
    );

    it(
      "rejects projection mismatch before opening a transaction",
      async () => {
        await expect(
          applyTruvernVendorInteractionResponse({
            assessmentId: 5,
            interactionId,
            sharedAnswer: "no",
            confirmedAt:
              "2026-10-07T00:00:00.000Z",
            components: [
              {
                ...componentOne,
                componentId:
                  "NOT-A-CERTIFIED-COMPONENT",
              },
            ],
          }),
        ).rejects.toThrow(
          "Interaction component does not match the certified questionnaire projection.",
        );

        expect(transactionMock).not.toHaveBeenCalled();
        expect(findResponseMock).not.toHaveBeenCalled();
        expect(updateResponseMock).not.toHaveBeenCalled();
      },
    );

    it(
      "rejects duplicate canonical response writes before opening a transaction",
      async () => {
        await expect(
          applyTruvernVendorInteractionResponse({
            assessmentId: 5,
            interactionId,
            sharedAnswer: "no",
            confirmedAt:
              "2026-10-07T00:00:00.000Z",
            components: [
              componentOne,
              {
                ...componentOne,
              },
            ],
          }),
        ).rejects.toThrow(
          "Duplicate canonical response write requested.",
        );

        expect(transactionMock).not.toHaveBeenCalled();
        expect(findResponseMock).not.toHaveBeenCalled();
        expect(updateResponseMock).not.toHaveBeenCalled();
      },
    );

    it(
      "rejects an empty component set before opening a transaction",
      async () => {
        await expect(
          applyTruvernVendorInteractionResponse({
            assessmentId: 5,
            interactionId,
            sharedAnswer: "no",
            confirmedAt:
              "2026-10-07T00:00:00.000Z",
            components: [],
          }),
        ).rejects.toThrow(
          "At least one canonical component must be supplied.",
        );

        expect(transactionMock).not.toHaveBeenCalled();
        expect(findResponseMock).not.toHaveBeenCalled();
        expect(updateResponseMock).not.toHaveBeenCalled();
      },
    );

    it(
      "rejects response-id substitution before any canonical update",
      async () => {
        findResponseMock
          .mockResolvedValueOnce({
            id: 1205,
            assessmentId: 5,
            questionId: 1,
            metadata: {},
          })
          .mockResolvedValueOnce(null);

        await expect(
          applyTruvernVendorInteractionResponse({
            assessmentId: 5,
            interactionId,
            sharedAnswer: "no",
            confirmedAt:
              "2026-10-07T00:00:00.000Z",
            components: [
              componentOne,
              componentTwo,
            ],
          }),
        ).rejects.toThrow(
          "Canonical response does not belong to the assessment and question supplied.",
        );

        expect(transactionMock).toHaveBeenCalledTimes(1);
        expect(findResponseMock).toHaveBeenCalledTimes(2);

        /*
         * Critical invariant:
         * every ownership read completes before the first write.
         */
        expect(updateResponseMock).not.toHaveBeenCalled();
      },
    );

    it(
      "uses authoritative canonical metadata instead of caller metadata",
      async () => {
        findResponseMock.mockResolvedValueOnce({
          id: 1205,
          assessmentId: 5,
          questionId: 1,
          metadata: {
            authoritativeServerValue:
              "preserve",
          },
        });

        await applyTruvernVendorInteractionResponse({
          assessmentId: 5,
          interactionId,
          sharedAnswer: "no",
          confirmedAt:
            "2026-10-07T00:00:00.000Z",
          components: [
            componentOne,
          ],
        });

        expect(
          updateResponseMock.mock.calls[0]?.[0],
        ).toMatchObject({
          data: {
            metadata: {
              authoritativeServerValue:
                "preserve",
              truvernVendorInteractionResponse: {
                interactionId,
                componentId:
                  "TRV-Q7R1-001-C01",
              },
            },
          },
        });
      },
    );

    it(
      "propagates a canonical write failure through the transaction boundary",
      async () => {
        updateResponseMock
          .mockResolvedValueOnce({
            id: 1205,
          })
          .mockRejectedValueOnce(
            new Error(
              "synthetic canonical write failure",
            ),
          );

        await expect(
          applyTruvernVendorInteractionResponse({
            assessmentId: 5,
            interactionId,
            sharedAnswer: "no",
            confirmedAt:
              "2026-10-07T00:00:00.000Z",
            components: [
              componentOne,
              componentTwo,
            ],
          }),
        ).rejects.toThrow(
          "synthetic canonical write failure",
        );

        expect(transactionMock).toHaveBeenCalledTimes(1);
        expect(findResponseMock).toHaveBeenCalledTimes(2);
        expect(updateResponseMock).toHaveBeenCalledTimes(2);
      },
    );
  },
);
