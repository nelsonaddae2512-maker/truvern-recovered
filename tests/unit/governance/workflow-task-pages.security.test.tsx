import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  actor: vi.fn(),
  assignments: vi.fn(),
  notFound: vi.fn(),
  queueSummary: vi.fn(),
  queueItems: vi.fn(),
  taskQuery: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  notFound: mocks.notFound,
}));

vi.mock("@/lib/auth/truvern-governance", () => ({
  getGovernanceActor: mocks.actor,
}));

vi.mock("@/lib/repositories/review-assignment-repository", () => ({
  findReviewAssignments: mocks.assignments,
}));

vi.mock(
  "@/lib/repositories/review-desk-workflow-queue-repository",
  () => ({
    readWorkflowQueueSummary: mocks.queueSummary,
    readOpenWorkflowQueueItems: mocks.queueItems,
  }),
);

vi.mock("@/lib/prisma", () => ({
  default: {
    $queryRaw: mocks.taskQuery,
  },
}));

vi.mock("@/components/review-desk/workflow-queue-actions.client", () => ({
  default: () => null,
}));

vi.mock("@/components/review-desk/claim-next-work-button.client", () => ({
  default: () => null,
}));

vi.mock("@/components/review-desk/workflow-task-actions.client", () => ({
  default: () => null,
}));

import WorkflowQueuePage from "@/app/review-desk/workflow-queue/page";
import WorkflowTasksPage from "@/app/review-desk/tasks/page";

const pages = [
  { name: "workflow queue", page: WorkflowQueuePage, alias: "qi" },
  { name: "task queue", page: WorkflowTasksPage, alias: "wt" },
] as const;

const emptyProps = { searchParams: Promise.resolve({}) };

function actor(role: string, organizationId: number | null = 21) {
  return {
    userId: "actor-1",
    role,
    organizationId,
    vendorId: null,
  };
}

function readsFor(name: string) {
  return name === "workflow queue"
    ? [mocks.queueSummary, mocks.queueItems]
    : [mocks.taskQuery];
}

function expectNoReads(name: string) {
  for (const read of readsFor(name)) {
    expect(read).not.toHaveBeenCalled();
  }
}

function scopesFor(name: string): Prisma.Sql[] {
  if (name === "workflow queue") {
    return [
      mocks.queueSummary.mock.calls[0][0],
      mocks.queueItems.mock.calls[0][0],
    ];
  }

  return mocks.taskQuery.mock.calls.map((call) => {
    // Prisma.$queryRaw is invoked as a tagged template.
    // The SQL fragment is an interpolation argument, not
    // a property of the template-strings array.
    const fragments = call.slice(1).filter(
      (value: unknown): value is Prisma.Sql =>
        typeof value === "object" &&
        value !== null &&
        "strings" in value &&
        "values" in value,
    );

    expect(fragments).toHaveLength(1);

    return fragments[0];
  });
}

function inspect(scope: Prisma.Sql) {
  return {
    text: scope.strings.join(" "),
    values: scope.values,
  };
}

beforeEach(() => {
  vi.resetAllMocks();

  mocks.actor.mockResolvedValue(actor("OWNER"));
  mocks.assignments.mockResolvedValue([]);
  mocks.queueSummary.mockResolvedValue([]);
  mocks.queueItems.mockResolvedValue([]);
  mocks.taskQuery.mockResolvedValue([]);

  mocks.notFound.mockImplementation(() => {
    throw new Error("NOT_FOUND");
  });
});

for (const entry of pages) {
  describe(`${entry.name} page authorization`, () => {
    it.each(["OWNER", "ADMIN", "ANALYST", "VIEWER"])(
      "scopes %s to the authenticated customer organization",
      async (role) => {
        mocks.actor.mockResolvedValue(actor(role, 44));

        await expect(entry.page(emptyProps)).resolves.toBeTruthy();

        const scopes = scopesFor(entry.name);
        expect(scopes).toHaveLength(2);

        for (const scope of scopes) {
          const result = inspect(scope);
          expect(result.text).toContain(
            `${entry.alias}."organizationId" = `,
          );
          expect(result.values).toEqual([44]);
        }

        expect(mocks.assignments).not.toHaveBeenCalled();
      },
    );

    it("does not hard-code the customer tenant", async () => {
      mocks.actor.mockResolvedValue(actor("ADMIN", 84));

      await entry.page(emptyProps);

      for (const scope of scopesFor(entry.name)) {
        expect(inspect(scope).values).toEqual([84]);
      }
    });

    it("limits a Truvern reviewer to assigned review IDs", async () => {
      mocks.actor.mockResolvedValue(
        actor("TRUVERN_REVIEWER", null),
      );

      mocks.assignments.mockResolvedValue([
        { id: 71 },
        { id: 72 },
      ]);

      await entry.page(emptyProps);

      expect(mocks.assignments).toHaveBeenCalledExactlyOnceWith({
        where: {
          assignmentType: "TRUVERN",
          reviewerUserId: "actor-1",
        },
        select: { id: true },
      });

      for (const scope of scopesFor(entry.name)) {
        const result = inspect(scope);

        expect(result.text).toContain(
          `${entry.alias}."reviewAssignmentId" IN (`,
        );
        expect(result.values).toEqual([71, 72]);
      }
    });

    it("fails closed for reviewer with no assignments", async () => {
      mocks.actor.mockResolvedValue(
        actor("TRUVERN_REVIEWER", null),
      );

      mocks.assignments.mockResolvedValue([]);

      await entry.page(emptyProps);

      for (const scope of scopesFor(entry.name)) {
        expect(inspect(scope).text.trim()).toBe("FALSE");
        expect(inspect(scope).values).toEqual([]);
      }
    });

    it("permits unrestricted scope only for verified Ops", async () => {
      mocks.actor.mockResolvedValue(actor("OPS", null));

      await entry.page(emptyProps);

      for (const scope of scopesFor(entry.name)) {
        expect(inspect(scope).text.trim()).toBe("TRUE");
        expect(inspect(scope).values).toEqual([]);
      }

      expect(mocks.assignments).not.toHaveBeenCalled();
    });

    it.each(["VENDOR", "UNKNOWN"])(
      "denies %s before database access",
      async (role) => {
        mocks.actor.mockResolvedValue(actor(role));

        await expect(entry.page(emptyProps)).rejects.toThrow(
          "NOT_FOUND",
        );

        expectNoReads(entry.name);
        expect(mocks.assignments).not.toHaveBeenCalled();
      },
    );

    it.each([null, 0, -1, 1.5, Number.NaN])(
      "denies invalid customer organization %s",
      async (organizationId) => {
        mocks.actor.mockResolvedValue(
          actor("OWNER", organizationId),
        );

        await expect(entry.page(emptyProps)).rejects.toThrow(
          "NOT_FOUND",
        );

        expectNoReads(entry.name);
      },
    );

    it("does not query when authentication fails", async () => {
      mocks.actor.mockRejectedValue(
        new Error("AUTH_REQUIRED"),
      );

      await expect(entry.page(emptyProps)).rejects.toThrow(
        "AUTH_REQUIRED",
      );

      expectNoReads(entry.name);
      expect(mocks.assignments).not.toHaveBeenCalled();
    });
  });
}