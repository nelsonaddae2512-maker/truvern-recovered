import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const mocks = vi.hoisted(() => ({
  bootstrapCurrentOrganizationFromRuntime:
    vi.fn(),
}));

vi.mock(
  "@/lib/auth/organization-bootstrap-runtime",
  () => ({
    bootstrapCurrentOrganizationFromRuntime:
      mocks.bootstrapCurrentOrganizationFromRuntime,
  }),
);

import { POST } from "@/app/api/access/bootstrap-organization/route";

describe(
  "organization bootstrap API route",
  () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it(
      "returns 401 for unauthenticated runtime",
      async () => {
        mocks.bootstrapCurrentOrganizationFromRuntime
          .mockResolvedValue({
            ok: false,
            reason: "UNAUTHENTICATED",
          });

        const response = await POST();
        const body = await response.json();

        expect(response.status).toBe(401);
        expect(body).toEqual({
          ok: false,
          reason: "UNAUTHENTICATED",
        });

        expect(
          response.headers.get("cache-control"),
        ).toBe("no-store");
      },
    );

    it(
      "returns 403 when no Clerk organization is selected",
      async () => {
        mocks.bootstrapCurrentOrganizationFromRuntime
          .mockResolvedValue({
            ok: false,
            reason: "NO_SELECTED_ORGANIZATION",
          });

        const response = await POST();
        const body = await response.json();

        expect(response.status).toBe(403);
        expect(body).toEqual({
          ok: false,
          reason: "NO_SELECTED_ORGANIZATION",
        });
      },
    );

    it(
      "returns 403 for an authenticated identity mismatch",
      async () => {
        mocks.bootstrapCurrentOrganizationFromRuntime
          .mockResolvedValue({
            ok: false,
            reason:
              "AUTHENTICATED_IDENTITY_MISMATCH",
          });

        const response = await POST();

        expect(response.status).toBe(403);
        expect(await response.json()).toEqual({
          ok: false,
          reason:
            "AUTHENTICATED_IDENTITY_MISMATCH",
        });
      },
    );

    it(
      "returns 403 when exact Clerk membership is required",
      async () => {
        mocks.bootstrapCurrentOrganizationFromRuntime
          .mockResolvedValue({
            ok: false,
            reason: "MEMBERSHIP_REQUIRED",
          });

        const response = await POST();

        expect(response.status).toBe(403);
        expect(await response.json()).toEqual({
          ok: false,
          reason: "MEMBERSHIP_REQUIRED",
        });
      },
    );

    it(
      "returns 409 when the Truvern user prerequisite is absent",
      async () => {
        mocks.bootstrapCurrentOrganizationFromRuntime
          .mockResolvedValue({
            ok: false,
            reason: "USER_NOT_PROVISIONED",
          });

        const response = await POST();

        expect(response.status).toBe(409);
        expect(await response.json()).toEqual({
          ok: false,
          reason: "USER_NOT_PROVISIONED",
        });
      },
    );

    it(
      "returns 409 for an organization identity conflict",
      async () => {
        mocks.bootstrapCurrentOrganizationFromRuntime
          .mockResolvedValue({
            ok: false,
            reason:
              "ORGANIZATION_IDENTITY_CONFLICT",
          });

        const response = await POST();

        expect(response.status).toBe(409);
        expect(await response.json()).toEqual({
          ok: false,
          reason:
            "ORGANIZATION_IDENTITY_CONFLICT",
        });
      },
    );

    it(
      "returns the certified bootstrap success result",
      async () => {
        mocks.bootstrapCurrentOrganizationFromRuntime
          .mockResolvedValue({
            ok: true,
            userId: 17,
            organizationId: 29,
            role: "ADMIN",
            userClaimed: true,
            organizationCreated: true,
            membershipCreated: true,
            primaryOrganizationUpdated: true,
          });

        const response = await POST();
        const body = await response.json();

        expect(response.status).toBe(200);

        expect(body).toEqual({
          ok: true,
          userId: 17,
          organizationId: 29,
          role: "ADMIN",
          userClaimed: true,
          organizationCreated: true,
          membershipCreated: true,
          primaryOrganizationUpdated: true,
        });

        expect(
          mocks.bootstrapCurrentOrganizationFromRuntime,
        ).toHaveBeenCalledTimes(1);
      },
    );

    it(
      "returns 500 without exposing thrown exception details",
      async () => {
        mocks.bootstrapCurrentOrganizationFromRuntime
          .mockRejectedValue(
            new Error("sensitive internal failure"),
          );

        const response = await POST();
        const body = await response.json();

        expect(response.status).toBe(500);
        expect(body).toEqual({
          ok: false,
          reason: "INTERNAL_ERROR",
        });

        expect(
          JSON.stringify(body),
        ).not.toContain(
          "sensitive internal failure",
        );
      },
    );
  },
);