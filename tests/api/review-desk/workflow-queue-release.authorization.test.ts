import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const mocks = vi.hoisted(() => ({
  requireReviewerAccess: vi.fn(),
  requireReviewAssignmentAccess: vi.fn(),
  requireGovernanceCapability: vi.fn(),
  governanceAuthErrorResponse: vi.fn(),
  governanceForbidden: vi.fn(
    (message: string) => {
      const error =
        new Error(
          message,
        ) as Error & {
          status?: number;
        };

      error.status = 403;

      return error;
    },
  ),
  findWorkflowQueueItem: vi.fn(),
  updateWorkflowQueueItems: vi.fn(),
  createWorkflowEvent: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock(
  "@/lib/auth/truvern-governance",
  () => ({
    requireReviewerAccess:
      mocks.requireReviewerAccess,
    requireReviewAssignmentAccess:
      mocks.requireReviewAssignmentAccess,
    requireGovernanceCapability:
      mocks.requireGovernanceCapability,
  }),
);

vi.mock(
  "@/lib/auth/governance-auth-errors",
  () => ({
    governanceAuthErrorResponse:
      mocks.governanceAuthErrorResponse,
    governanceForbidden:
      mocks.governanceForbidden,
  }),
);

vi.mock(
  "@/lib/prisma",
  () => ({
    default: {
      $transaction:
        mocks.transaction,
    },
  }),
);

vi.mock(
  "@/lib/repositories/workflow-queue-repository",
  () => ({
    findWorkflowQueueItem:
      mocks.findWorkflowQueueItem,
    updateWorkflowQueueItems:
      mocks.updateWorkflowQueueItems,
  }),
);

vi.mock(
  "@/lib/repositories/workflow-event-repository",
  () => ({
    createWorkflowEvent:
      mocks.createWorkflowEvent,
  }),
);

import {
  POST,
} from "@/app/api/review-desk/workflow-queue/[id]/release/route";

const props =
  (id: string) => ({
    params:
      Promise.resolve({
        id,
      }),
  });

const openItem = {
  id: 51,
  status: "OPEN",
  workflowId: 10,
  organizationId: 7,
  vendorId: 8,
  reviewAssignmentId:
    null as number | null,
  payload: {},
};

function actor(
  role:
    | "OPS"
    | "TRUVERN_REVIEWER"
    | "OWNER"
    | "ADMIN"
    | "ANALYST",
  organizationId:
    number | null,
) {
  return {
    userId:
      "user-authenticated",
    organizationId,
    vendorId: null,
    role,
  };
}

describe(
  "workflow queue specific release authorization",
  () => {
    beforeEach(() => {
      vi.clearAllMocks();

      mocks.governanceAuthErrorResponse.
        mockImplementation(
          (error: any) => {
            if (
              error?.status === 403
            ) {
              return Response.json(
                {
                  ok: false,
                  error:
                    error.message,
                },
                {
                  status: 403,
                },
              );
            }

            return null;
          },
        );

      mocks.updateWorkflowQueueItems.
        mockResolvedValue({
          count: 1,
        });

      mocks.createWorkflowEvent.
        mockResolvedValue({});

      mocks.transaction.
        mockImplementation(
          async (
            callback: (
              tx: object,
            ) => Promise<unknown>,
          ) => callback({}),
        );
    });

    it(
      "rejects invalid ids before mutation",
      async () => {
        mocks.requireReviewerAccess.
          mockResolvedValue(
            actor(
              "ADMIN",
              7,
            ),
          );

        const response =
          await POST(
            new Request(
              "http://localhost",
              {
                method: "POST",
              },
            ),
            props("bad"),
          );

        expect(
          response.status,
        ).toBe(400);

        expect(
          mocks.updateWorkflowQueueItems,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      "uses assignment authorization for assignment-backed release",
      async () => {
        mocks.requireReviewerAccess.
          mockResolvedValue(
            actor(
              "TRUVERN_REVIEWER",
              null,
            ),
          );

        const assignedItem = {
          ...openItem,
          reviewAssignmentId:
            91,
        };

        mocks.findWorkflowQueueItem
          .mockResolvedValueOnce(
            assignedItem,
          )
          .mockResolvedValueOnce(
            assignedItem,
          )
          .mockResolvedValueOnce(
            assignedItem,
          );

        mocks.requireReviewAssignmentAccess.
          mockResolvedValue({});

        const response =
          await POST(
            new Request(
              "http://localhost",
              {
                method: "POST",
              },
            ),
            props("51"),
          );

        expect(
          response.status,
        ).toBe(200);

        expect(
          mocks.requireReviewAssignmentAccess,
        ).toHaveBeenCalledWith(
          91,
        );

        expect(
          mocks.createWorkflowEvent,
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            data:
              expect.objectContaining({
                actor:
                  "user-authenticated",
              }),
          }),
          expect.anything(),
        );
      },
    );

    it(
      "allows same-organization customer fallback",
      async () => {
        mocks.requireReviewerAccess.
          mockResolvedValue(
            actor(
              "ADMIN",
              7,
            ),
          );

        mocks.findWorkflowQueueItem
          .mockResolvedValueOnce(
            openItem,
          )
          .mockResolvedValueOnce(
            openItem,
          )
          .mockResolvedValueOnce(
            openItem,
          );

        const response =
          await POST(
            new Request(
              "http://localhost",
              {
                method: "POST",
              },
            ),
            props("51"),
          );

        expect(
          response.status,
        ).toBe(200);

        expect(
          mocks.requireReviewAssignmentAccess,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      "denies cross-organization customer fallback",
      async () => {
        mocks.requireReviewerAccess.
          mockResolvedValue(
            actor(
              "ADMIN",
              99,
            ),
          );

        mocks.findWorkflowQueueItem.
          mockResolvedValue(
            openItem,
          );

        const response =
          await POST(
            new Request(
              "http://localhost",
              {
                method: "POST",
              },
            ),
            props("51"),
          );

        expect(
          response.status,
        ).toBe(403);

        expect(
          mocks.updateWorkflowQueueItems,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      "denies unassigned fallback to Truvern reviewer",
      async () => {
        mocks.requireReviewerAccess.
          mockResolvedValue(
            actor(
              "TRUVERN_REVIEWER",
              null,
            ),
          );

        mocks.findWorkflowQueueItem.
          mockResolvedValue(
            openItem,
          );

        const response =
          await POST(
            new Request(
              "http://localhost",
              {
                method: "POST",
              },
            ),
            props("51"),
          );

        expect(
          response.status,
        ).toBe(403);

        expect(
          mocks.updateWorkflowQueueItems,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      "allows OPS fallback",
      async () => {
        mocks.requireReviewerAccess.
          mockResolvedValue(
            actor(
              "OPS",
              null,
            ),
          );

        mocks.findWorkflowQueueItem
          .mockResolvedValueOnce(
            openItem,
          )
          .mockResolvedValueOnce(
            openItem,
          )
          .mockResolvedValueOnce(
            openItem,
          );

        const response =
          await POST(
            new Request(
              "http://localhost",
              {
                method: "POST",
              },
            ),
            props("51"),
          );

        expect(
          response.status,
        ).toBe(200);
      },
    );

    it(
      "maps assignment authorization denial before mutation",
      async () => {
        mocks.requireReviewerAccess.
          mockResolvedValue(
            actor(
              "TRUVERN_REVIEWER",
              null,
            ),
          );

        mocks.findWorkflowQueueItem.
          mockResolvedValue({
            ...openItem,
            reviewAssignmentId:
              91,
          });

        const denied =
          new Error(
            "Assignment denied.",
          ) as Error & {
            status?: number;
          };

        denied.status = 403;

        mocks.requireReviewAssignmentAccess.
          mockRejectedValue(
            denied,
          );

        const response =
          await POST(
            new Request(
              "http://localhost",
              {
                method: "POST",
              },
            ),
            props("51"),
          );

        expect(
          response.status,
        ).toBe(403);

        expect(
          mocks.updateWorkflowQueueItems,
        ).not.toHaveBeenCalled();
      },
    );
  },
);