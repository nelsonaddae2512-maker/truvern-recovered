import { describe, expect, it } from "vitest";
import {
  createJsonRequest,
  createRouteContext,
} from "@/tests/support/http";
import { createPrismaTestDouble } from "@/tests/support/prisma";

describe("Truvern test foundation", () => {
  it("creates JSON requests for route-handler tests", async () => {
    const request = createJsonRequest(
      "http://localhost/api/example",
      {
        body: {
          acceptedAcknowledgement: true,
        },
      },
    );

    expect(request.method).toBe("POST");
    expect(request.headers.get("content-type")).toBe(
      "application/json",
    );
    await expect(request.json()).resolves.toEqual({
      acceptedAcknowledgement: true,
    });
  });

  it("creates Next.js-compatible async route params", async () => {
    const context = createRouteContext({ id: "42" });

    await expect(context.params).resolves.toEqual({
      id: "42",
    });
  });

  it("provides an isolated Prisma test double", async () => {
    const prisma = createPrismaTestDouble();

    prisma.$queryRawUnsafe.mockResolvedValue([
      { id: 1 },
    ]);

    await expect(
      prisma.$queryRawUnsafe("select 1"),
    ).resolves.toEqual([{ id: 1 }]);

    expect(prisma.$queryRawUnsafe).toHaveBeenCalledOnce();
  });
});
