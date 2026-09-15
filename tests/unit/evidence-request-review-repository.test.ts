import { describe, expect, it, vi } from "vitest";
import { updateEvidenceRequestReviewStatus } from "@/lib/repositories/evidence-request-review-repository";

function createFakeClient() {
  const update = vi.fn().mockImplementation(
    async ({
      where,
      data,
    }: {
      where: { id: number };
      data: {
        status: string;
        reviewedAt?: Date | null;
        updatedAt: Date;
      };
    }) => ({
      id: where.id,
      status: data.status,
      updatedAt: data.updatedAt,
    }),
  );

  return {
    evidenceRequest: {
      update,
    },
  };
}

describe("evidence request reviewer decision lifecycle", () => {
  it.each(["APPROVED", "REJECTED"])(
    "sets reviewedAt for %s using the decision timestamp",
    async (status) => {
      const client = createFakeClient();

      await updateEvidenceRequestReviewStatus(
        {
          id: 42,
          status,
        },
        client as never,
      );

      expect(client.evidenceRequest.update).toHaveBeenCalledTimes(1);

      const call =
        client.evidenceRequest.update.mock.calls[0]?.[0];

      expect(call).toBeDefined();
      expect(call.where).toEqual({
        id: 42,
      });
      expect(call.data.status).toBe(status);
      expect(call.data.reviewedAt).toBeInstanceOf(Date);
      expect(call.data.updatedAt).toBeInstanceOf(Date);
      expect(call.data.reviewedAt).toBe(call.data.updatedAt);
    },
  );

  it("clears reviewedAt when the request is reopened", async () => {
    const client = createFakeClient();

    await updateEvidenceRequestReviewStatus(
      {
        id: 42,
        status: "REQUESTED",
      },
      client as never,
    );

    const call =
      client.evidenceRequest.update.mock.calls[0]?.[0];

    expect(call).toBeDefined();
    expect(call.data.status).toBe("REQUESTED");
    expect(call.data.reviewedAt).toBeNull();
    expect(call.data.updatedAt).toBeInstanceOf(Date);
  });

  it("leaves reviewedAt untouched for unrelated statuses", async () => {
    const client = createFakeClient();

    await updateEvidenceRequestReviewStatus(
      {
        id: 42,
        status: "SUBMITTED",
      },
      client as never,
    );

    const call =
      client.evidenceRequest.update.mock.calls[0]?.[0];

    expect(call).toBeDefined();
    expect(call.data.status).toBe("SUBMITTED");
    expect(call.data.reviewedAt).toBeUndefined();
    expect(call.data.updatedAt).toBeInstanceOf(Date);
  });
});
