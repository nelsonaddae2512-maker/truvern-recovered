import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createJsonRequest,
  createRouteContext,
  readJsonResponse,
} from "@/tests/support/http";

const mocks = vi.hoisted(() => ({
  auth: vi.fn<() => Promise<{ userId: string | null }>>(),
  requireDbOrganization: vi.fn<() => Promise<{ id: number }>>(),
  requireReviewerAccess: vi.fn(),
  requireGovernanceCapability: vi.fn(),
  reviewAssignmentFindUnique: vi.fn(),
  readReviewReleaseAssignment: vi.fn(),
  readLatestReviewReleaseResponse: vi.fn(),
  readLatestGovernanceTransparencyEntryHash: vi.fn(),
  persistGovernanceTransparencyLedgerEntry: vi.fn(),
  readReviewReleaseEvidenceRequests: vi.fn(),
  updateReviewResponseResponses: vi.fn(),
  persistVendorGovernanceMemory: vi.fn(),
  persistGovernanceReleaseManifest: vi.fn(),
  consumeReservedReviewCredits: vi.fn(),
  scheduleVendorReassessment: vi.fn(),
  queryRawUnsafe:
    vi.fn<(...args: unknown[]) => Promise<unknown[]>>(),
  executeRawUnsafe:
    vi.fn<(...args: unknown[]) => Promise<number>>(),
  buildCanonicalGovernanceArtifact:
    vi.fn<(...args: unknown[]) => unknown>(),
  buildGovernanceReleasePackage:
    vi.fn<(...args: unknown[]) => unknown>(),
  getReviewEvidence:
    vi.fn<(...args: unknown[]) => Promise<unknown[]>>(),
  buildEvidenceSnapshot:
    vi.fn<(...args: unknown[]) => unknown>(),
  checksumJson:
    vi.fn<(...args: unknown[]) => string>(),
  createOrgNotification:
    vi.fn<(...args: unknown[]) => Promise<void>>(),
  createGovernanceNotarizationReceipt:
    vi.fn<(...args: unknown[]) => unknown>(),
  generateLedgerEntry:
    vi.fn<(...args: unknown[]) => unknown>(),
  maybePersistTransparencyCheckpoint:
    vi.fn<(...args: unknown[]) => Promise<void>>(),
  buildSignedGovernanceManifest:
    vi.fn<(...args: unknown[]) => unknown>(),
  signGovernancePayload:
    vi.fn<(...args: unknown[]) => unknown>(),
}));

vi.mock("@clerk/nextjs/server", () => ({
  auth: mocks.auth,
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    reviewAssignment: {
      findUnique: mocks.reviewAssignmentFindUnique,
    },
    $queryRawUnsafe: mocks.queryRawUnsafe,
    $executeRawUnsafe: mocks.executeRawUnsafe,
  },
}));

vi.mock("@/lib/org-db", () => ({
  requireDbOrganization: mocks.requireDbOrganization,
}));

vi.mock("@/lib/auth/truvern-governance", () => ({
  requireReviewerAccess: mocks.requireReviewerAccess,
  requireGovernanceCapability: mocks.requireGovernanceCapability,
}));

vi.mock("@/lib/repositories/review-release-repository", async () => {
  const actual =
    await vi.importActual<
      typeof import("@/lib/repositories/review-release-repository")
    >("@/lib/repositories/review-release-repository");

  return {
    ...actual,
    readReviewReleaseAssignment:
      mocks.readReviewReleaseAssignment,
    readLatestReviewReleaseResponse:
      mocks.readLatestReviewReleaseResponse,
    readLatestGovernanceTransparencyEntryHash:
      mocks.readLatestGovernanceTransparencyEntryHash,
    persistGovernanceTransparencyLedgerEntry:
      mocks.persistGovernanceTransparencyLedgerEntry,
    readReviewReleaseEvidenceRequests:
      mocks.readReviewReleaseEvidenceRequests,
    updateReviewResponseResponses:
      mocks.updateReviewResponseResponses,
    persistVendorGovernanceMemory:
      mocks.persistVendorGovernanceMemory,
    persistGovernanceReleaseManifest:
      mocks.persistGovernanceReleaseManifest,
  };
});

vi.mock("@/lib/services/release/release-credit-service", () => ({
  consumeReservedReviewCredits:
    mocks.consumeReservedReviewCredits,
}));

vi.mock("@/lib/services/vendor-reassessment-service", () => ({
  scheduleVendorReassessment:
    mocks.scheduleVendorReassessment,
}));

vi.mock(
  "@/lib/governance/canonical-governance-artifact",
  () => ({
    buildCanonicalGovernanceArtifact:
      mocks.buildCanonicalGovernanceArtifact,
  }),
);

vi.mock("@/lib/governance/governance-release-package", () => ({
  buildGovernanceReleasePackage:
    mocks.buildGovernanceReleasePackage,
}));

vi.mock("@/lib/evidence/queries", () => ({
  getReviewEvidence: mocks.getReviewEvidence,
}));

vi.mock("@/lib/evidence/snapshot", () => ({
  buildEvidenceSnapshot: mocks.buildEvidenceSnapshot,
}));

vi.mock("@/lib/evidence/checksum", () => ({
  checksumJson: mocks.checksumJson,
}));

vi.mock("@/lib/notifications/create-notification", () => ({
  createOrgNotification: mocks.createOrgNotification,
}));

vi.mock("@/lib/governance/notarization", () => ({
  createGovernanceNotarizationReceipt:
    mocks.createGovernanceNotarizationReceipt,
}));

vi.mock("@/lib/governance/transparency-ledger", () => ({
  generateLedgerEntry: mocks.generateLedgerEntry,
}));

vi.mock("@/lib/governance/auto-checkpoint-policy", () => ({
  maybePersistTransparencyCheckpoint:
    mocks.maybePersistTransparencyCheckpoint,
}));

vi.mock("@/lib/governance/manifest", () => ({
  buildSignedGovernanceManifest:
    mocks.buildSignedGovernanceManifest,
}));

vi.mock("@/lib/governance-signature", () => ({
  signGovernancePayload: mocks.signGovernancePayload,
}));

import { POST } from "@/app/api/review-desk/reviews/[id]/confirm-release/route";

type ErrorBody = {
  ok: false;
  error: string;
};

type SuccessBody = {
  ok: true;
  responseId: number;
  releaseState: "CONFIRMED";
  alreadyConfirmed?: boolean;
  checksum?: string;
  creditConsumption?: {
    consumed: boolean;
    alreadyConsumed: boolean;
    eventKey: string;
  };
};

function request(body: unknown = { acceptedAcknowledgement: true }) {
  return createJsonRequest(
    "http://localhost/api/review-desk/reviews/42/confirm-release",
    { body },
  );
}

function context(id = "42") {
  return createRouteContext({ id });
}

function assignment(overrides: Record<string, unknown> = {}) {
  return {
    id: 42,
    organizationId: 7,
    vendorId: 11,
    vendorName: "Acme Vendor",
    assignmentType: "TRUVERN",
    ...overrides,
  };
}

function responseRow(
  responses: Record<string, unknown>,
  overrides: Record<string, unknown> = {},
) {
  return {
    id: 101,
    reviewAssignmentId: 42,
    responses,
    ...overrides,
  };
}

describe("POST /api/review-desk/reviews/[id]/confirm-release", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.readLatestGovernanceTransparencyEntryHash.mockResolvedValue(null);
    mocks.persistGovernanceTransparencyLedgerEntry.mockResolvedValue(undefined);
    mocks.readReviewReleaseEvidenceRequests.mockResolvedValue([]);
    mocks.updateReviewResponseResponses.mockResolvedValue(undefined);
    mocks.persistVendorGovernanceMemory.mockResolvedValue(undefined);
    mocks.persistGovernanceReleaseManifest.mockResolvedValue(undefined);

    mocks.auth.mockResolvedValue({
      userId: "user_test_1",
    });

    mocks.requireDbOrganization.mockResolvedValue({
      id: 7,
    });
    mocks.requireReviewerAccess.mockResolvedValue({
      userId: "user_test_1",
      organizationId: 7,
      vendorId: null,
      role: "OWNER",
    });
    mocks.requireGovernanceCapability.mockReturnValue({
      userId: "user_test_1",
      organizationId: 7,
      vendorId: null,
      role: "OWNER",
    });
    mocks.reviewAssignmentFindUnique.mockResolvedValue({
      organizationId: 7,
    });

    mocks.readReviewReleaseAssignment.mockResolvedValue(
      assignment(),
    );
    mocks.readLatestReviewReleaseResponse.mockResolvedValue(
      responseRow({}),
    );
    mocks.queryRawUnsafe.mockResolvedValue([]);
    mocks.executeRawUnsafe.mockResolvedValue(1);
    mocks.getReviewEvidence.mockResolvedValue([]);
    mocks.createOrgNotification.mockResolvedValue();
    mocks.consumeReservedReviewCredits.mockResolvedValue({
      consumed: false,
      alreadyConsumed: true,
      eventKey: "review:42:consumption",
    });
    mocks.scheduleVendorReassessment.mockResolvedValue(null);
    mocks.maybePersistTransparencyCheckpoint.mockResolvedValue();
  });

  it("returns 401 when the caller is not authenticated", async () => {
    mocks.auth.mockResolvedValue({
      userId: null,
    });

    const result = await POST(request(), context());
    const body = await readJsonResponse<ErrorBody>(result);

    expect(result.status).toBe(401);
    expect(body).toEqual({
      ok: false,
      error: "Unauthorized",
    });
    expect(
      result.headers.get("cache-control"),
    ).toBe("no-store");
    expect(mocks.requireDbOrganization).not.toHaveBeenCalled();
    expect(mocks.queryRawUnsafe).not.toHaveBeenCalled();
  });

  it("returns 403 when the caller lacks release authority", async () => {
    mocks.requireGovernanceCapability.mockImplementation(() => {
      throw new Error("Release authority required");
    });

    const result = await POST(request(), context());
    const body = await readJsonResponse<ErrorBody>(result);

    expect(result.status).toBe(403);
    expect(body).toEqual({
      ok: false,
      error: "Release authority required",
    });
    expect(
      mocks.requireGovernanceCapability,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 7,
        role: "OWNER",
      }),
      "report.release",
    );
    expect(mocks.queryRawUnsafe).not.toHaveBeenCalled();
  });

  it.each(["", "0", "-1", "abc"])(
    "returns 400 for invalid assignment id %j",
    async (id) => {
      const result = await POST(request(), context(id));
      const body = await readJsonResponse<ErrorBody>(result);

      expect(result.status).toBe(400);
      expect(body).toEqual({
        ok: false,
        error: "Invalid assignment id.",
      });
      expect(mocks.queryRawUnsafe).not.toHaveBeenCalled();
    },
  );

  it("requires explicit customer acknowledgement", async () => {
    const result = await POST(
      request({ acceptedAcknowledgement: false }),
      context(),
    );
    const body = await readJsonResponse<ErrorBody>(result);

    expect(result.status).toBe(400);
    expect(body.error).toContain(
      "Customer acknowledgement acceptance is required",
    );
    expect(mocks.queryRawUnsafe).not.toHaveBeenCalled();
  });

  it("returns 404 when the review assignment does not exist", async () => {
    mocks.readReviewReleaseAssignment.mockResolvedValueOnce(null);

    const result = await POST(request(), context());
    const body = await readJsonResponse<ErrorBody>(result);

    expect(result.status).toBe(404);
    expect(body).toEqual({
      ok: false,
      error: "Review assignment not found.",
    });
    expect(
      mocks.readReviewReleaseAssignment,
    ).toHaveBeenCalledWith(42);
    expect(
      mocks.readLatestReviewReleaseResponse,
    ).not.toHaveBeenCalled();
    expect(mocks.executeRawUnsafe).not.toHaveBeenCalled();
  });

  it("returns 404 when the review response does not exist", async () => {
    mocks.readLatestReviewReleaseResponse.mockResolvedValueOnce(
      null,
    );

    const result = await POST(request(), context());
    const body = await readJsonResponse<ErrorBody>(result);

    expect(result.status).toBe(404);
    expect(body).toEqual({
      ok: false,
      error: "Review response not found.",
    });
    expect(
      mocks.readReviewReleaseAssignment,
    ).toHaveBeenCalledWith(42);
    expect(
      mocks.readLatestReviewReleaseResponse,
    ).toHaveBeenCalledWith(42);
    expect(mocks.executeRawUnsafe).not.toHaveBeenCalled();
  });

  it("rejects unsupported review assignment types", async () => {
    mocks.readReviewReleaseAssignment.mockResolvedValueOnce(
      assignment({ assignmentType: "EXTERNAL" }),
    );
    mocks.readLatestReviewReleaseResponse.mockResolvedValueOnce(
      responseRow({ releaseState: "RELEASED" }),
    );

    const result = await POST(request(), context());
    const body = await readJsonResponse<ErrorBody>(result);

    expect(result.status).toBe(409);
    expect(body).toEqual({
      ok: false,
      error: "Unsupported review assignment type.",
    });
    expect(mocks.executeRawUnsafe).not.toHaveBeenCalled();
  });

  it("rejects an outcome that has not reached RELEASED state", async () => {
    mocks.readReviewReleaseAssignment.mockResolvedValueOnce(
      assignment(),
    );
    mocks.readLatestReviewReleaseResponse.mockResolvedValueOnce(
      responseRow({ releaseState: "IN_REVIEW" }),
    );

    const result = await POST(request(), context());
    const body = await readJsonResponse<ErrorBody>(result);

    expect(result.status).toBe(409);
    expect(body).toEqual({
      ok: false,
      error: "Only released Truvern outcomes can be confirmed.",
    });
    expect(mocks.executeRawUnsafe).not.toHaveBeenCalled();
  });

  it("returns a safe idempotent success for an already sealed confirmation", async () => {
    const checksum = "ABC123SEALED";

    mocks.readReviewReleaseAssignment.mockResolvedValueOnce(
      assignment(),
    );
    mocks.readLatestReviewReleaseResponse.mockResolvedValueOnce(
      responseRow({
          releaseState: "CONFIRMED",
          governanceReleaseSnapshot: {
            governanceSeal: {
              checksum,
              notarizationReceipt: {
                receiptId: "receipt-1",
              },
              transparencyLedgerEntry: {
                entryId: "entry-1",
              },
            },
          },
        }),
    );

    const result = await POST(request(), context());
    const body = await readJsonResponse<SuccessBody>(result);

    expect(result.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.releaseState).toBe("CONFIRMED");
    expect(body.alreadyConfirmed).toBe(true);
    expect(body.checksum).toBe(checksum);
    expect(body.creditConsumption).toEqual({
      consumed: false,
      alreadyConsumed: true,
      eventKey: "review:42:consumption",
    });

    expect(mocks.executeRawUnsafe).not.toHaveBeenCalled();
    expect(mocks.createOrgNotification).not.toHaveBeenCalled();
  });

  it("rejects a confirmed record that has no recoverable checksum", async () => {
    mocks.readReviewReleaseAssignment.mockResolvedValueOnce(
      assignment(),
    );
    mocks.readLatestReviewReleaseResponse.mockResolvedValueOnce(
      responseRow({
        releaseState: "CONFIRMED",
        governanceSeal: {},
      }),
    );

    const result = await POST(request(), context());
    const body = await readJsonResponse<ErrorBody>(result);

    expect(result.status).toBe(409);
    expect(body).toEqual({
      ok: false,
      error: "Confirmed review is missing governance checksum.",
    });
    expect(mocks.executeRawUnsafe).not.toHaveBeenCalled();
  });
});
