import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireReviewerAccess: vi.fn(),
  requireGovernanceCapability: vi.fn(),
  requireFrameworkAssessmentAccess: vi.fn(),

  countTruvernAssessmentFindings: vi.fn(),
  countTruvernRemediationRequests: vi.fn(),
  countTruvernAssessmentAttestations: vi.fn(),

  findTruvernFrameworkAssessment: vi.fn(),
  updateTruvernFrameworkAssessment: vi.fn(),
  insertGovernanceAuditLog: vi.fn(),

  buildFrameworkReleaseSnapshot: vi.fn(),
  checksumSnapshot: vi.fn(),
  stableJson: vi.fn(),
  signGovernancePayload: vi.fn(),

  transaction: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    $transaction: mocks.transaction,
  },
}));

vi.mock("@/lib/auth/governance-auth-errors", () => ({
  governanceAuthErrorResponse: vi.fn(() => null),
}));

vi.mock("@/lib/auth/truvern-governance", () => ({
  requireReviewerAccess: mocks.requireReviewerAccess,
  requireGovernanceCapability:
    mocks.requireGovernanceCapability,
  requireFrameworkAssessmentAccess:
    mocks.requireFrameworkAssessmentAccess,
}));

vi.mock(
  "@/lib/repositories/truvern-framework-assessment-repository",
  () => ({
    findTruvernFrameworkAssessment:
      mocks.findTruvernFrameworkAssessment,
    updateTruvernFrameworkAssessment:
      mocks.updateTruvernFrameworkAssessment,
  }),
);

vi.mock(
  "@/lib/repositories/truvern-assessment-finding-repository",
  () => ({
    countTruvernAssessmentFindings:
      mocks.countTruvernAssessmentFindings,
  }),
);

vi.mock(
  "@/lib/repositories/truvern-remediation-request-repository",
  () => ({
    countTruvernRemediationRequests:
      mocks.countTruvernRemediationRequests,
  }),
);

vi.mock(
  "@/lib/repositories/truvern-assessment-attestation-repository",
  () => ({
    countTruvernAssessmentAttestations:
      mocks.countTruvernAssessmentAttestations,
  }),
);

vi.mock(
  "@/lib/repositories/governance-audit-log-repository",
  () => ({
    insertGovernanceAuditLog:
      mocks.insertGovernanceAuditLog,
  }),
);

vi.mock("@/lib/governance/framework-release", () => ({
  buildFrameworkReleaseSnapshot:
    mocks.buildFrameworkReleaseSnapshot,
  checksumSnapshot:
    mocks.checksumSnapshot,
  stableJson:
    mocks.stableJson,
}));

vi.mock("@/lib/governance-signature", () => ({
  signGovernancePayload:
    mocks.signGovernancePayload,
}));

import { POST } from "@/app/api/truvern/framework-assessments/[id]/confirm-release/route";

function context(id = "5") {
  return {
    params: Promise.resolve({ id }),
  };
}

function request() {
  return new Request(
    "http://localhost/api/truvern/framework-assessments/5/confirm-release",
    {
      method: "POST",
    },
  );
}

function assessment(overrides: Record<string, unknown> = {}) {
  return {
    id: 5,
    organizationId: 9,
    vendorId: 22,
    status: "READY_FOR_RELEASE",
    readyForReleaseAt:
      new Date("2026-10-05T20:00:00.000Z"),
    releasedAt: null,
    metadata: {
      existingMetadata: "preserved",
    },
    framework: {},
    responses: [],
    findings: [],
    attestations: [],
    ...overrides,
  };
}

describe("framework assessment confirm-release guardrails", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.requireReviewerAccess.mockResolvedValue({
      userId: "reviewer-1",
    });

    mocks.requireGovernanceCapability.mockReturnValue(
      undefined,
    );

    mocks.requireFrameworkAssessmentAccess.mockResolvedValue(
      undefined,
    );

    mocks.countTruvernAssessmentFindings.mockResolvedValue(0);
    mocks.countTruvernRemediationRequests.mockResolvedValue(0);
    mocks.countTruvernAssessmentAttestations.mockResolvedValue(0);

    mocks.findTruvernFrameworkAssessment.mockResolvedValue(
      assessment(),
    );

    mocks.buildFrameworkReleaseSnapshot.mockReturnValue({
      schema: "truvern.framework-release.test.v1",
      assessmentId: 5,
    });

    mocks.checksumSnapshot.mockReturnValue(
      "test-checksum",
    );

    mocks.stableJson.mockImplementation(
      (value: unknown) => JSON.stringify(value),
    );

    mocks.signGovernancePayload.mockReturnValue({
      algorithm: "test-signature",
      signature: "test-signature-value",
      signedAt: "2026-10-05T20:30:00.000Z",
      keyId: "test-key",
      payloadHash: "test-payload-hash",
    });

    mocks.updateTruvernFrameworkAssessment.mockImplementation(
      async (
        args: {
          where: {
            id: number;
          };
          data: {
            status: string;
            releasedAt: Date;
            readyForReleaseAt: Date;
            metadata: unknown;
          };
        },
        _tx: unknown,
      ) => ({
        id: args.where.id,
        organizationId: 9,
        vendorId: 22,
        ...args.data,
      }),
    );

    mocks.insertGovernanceAuditLog.mockResolvedValue(
      undefined,
    );

    mocks.transaction.mockImplementation(
      async (
        callback: (tx: Record<string, never>) => Promise<unknown>,
      ) => callback({}),
    );
  });

  it("rejects an assessment that is not ready without release mutation or audit", async () => {
    mocks.findTruvernFrameworkAssessment.mockResolvedValue(
      assessment({
        status: "IN_REVIEW",
        readyForReleaseAt: null,
      }),
    );

    const response = await POST(
      request(),
      context(),
    );

    expect(response.status).toBe(409);

    const body = await response.json();

    expect(body).toMatchObject({
      ok: false,
      code: "FRAMEWORK_RELEASE_NOT_READY",
      currentStatus: "IN_REVIEW",
      readyForReleaseAt: null,
    });

    expect(
      mocks.updateTruvernFrameworkAssessment,
    ).not.toHaveBeenCalled();

    expect(
      mocks.insertGovernanceAuditLog,
    ).not.toHaveBeenCalled();

    expect(
      mocks.transaction,
    ).not.toHaveBeenCalled();
  });

  it("confirms a READY_FOR_RELEASE assessment exactly once with immutable release state and audit", async () => {
    const readyAt =
      new Date("2026-10-05T20:00:00.000Z");

    mocks.findTruvernFrameworkAssessment.mockResolvedValue(
      assessment({
        status: "READY_FOR_RELEASE",
        readyForReleaseAt: readyAt,
        releasedAt: null,
      }),
    );

    const response = await POST(
      request(),
      context(),
    );

    expect(response.status).toBe(200);

    const body = await response.json();

    expect(body.ok).toBe(true);

    expect(
      mocks.transaction,
    ).toHaveBeenCalledTimes(1);

    expect(
      mocks.updateTruvernFrameworkAssessment,
    ).toHaveBeenCalledTimes(1);

    const updateCall =
      mocks.updateTruvernFrameworkAssessment.mock.calls[0][0];

    expect(updateCall.where).toEqual({
      id: 5,
    });

    expect(updateCall.data.status).toBe(
      "RELEASED",
    );

    expect(
      updateCall.data.releasedAt,
    ).toBeInstanceOf(Date);

    expect(
      updateCall.data.readyForReleaseAt,
    ).toEqual(readyAt);

    expect(
      updateCall.data.metadata,
    ).toMatchObject({
      existingMetadata: "preserved",
      governanceReleaseSnapshot: {
        schema: "truvern.framework-release.test.v1",
        assessmentId: 5,
      },
      governanceSeal: {
        algorithm: "sha256",
        checksum: "test-checksum",
        schema: "truvern.framework-release.test.v1",
        version: 1,
        cryptographicSignature: {
          algorithm: "test-signature",
          signature: "test-signature-value",
          signedAt: "2026-10-05T20:30:00.000Z",
          keyId: "test-key",
          payloadHash: "test-payload-hash",
        },
      },
    });

    expect(
      mocks.insertGovernanceAuditLog,
    ).toHaveBeenCalledTimes(1);

    const auditCall =
      mocks.insertGovernanceAuditLog.mock.calls[0][0];

    expect(auditCall).toMatchObject({
      organizationId: 9,
      actorUserId: "reviewer-1",
      entityType: "TruvernFrameworkAssessment",
      entityId: "5",
      action: "FRAMEWORK_RELEASE_CONFIRMED",
      message:
        "Framework assessment immutable release was confirmed.",
    });

    expect(
      typeof auditCall.metadataJson,
    ).toBe("string");

    const auditMetadata =
      JSON.parse(auditCall.metadataJson);

    expect(auditMetadata).toMatchObject({
      checksum: "test-checksum",
      schema: "truvern.framework-release.test.v1",
    });

    expect(
      typeof auditMetadata.sealedAt,
    ).toBe("string");

    expect(body.assessment).toMatchObject({
      id: 5,
      organizationId: 9,
      status: "RELEASED",
    });

    expect(body.seal).toMatchObject({
      algorithm: "sha256",
      checksum: "test-checksum",
      schema: "truvern.framework-release.test.v1",
      version: 1,
    });

    expect(body.verifyUrl).toBe(
      "/api/truvern/framework-assessments/5/verify",
    );

    expect(body.packetUrl).toBe(
      "/api/truvern/framework-assessments/5/packet",
    );
  });

  it("rejects an already released assessment without a second mutation or audit", async () => {
    mocks.findTruvernFrameworkAssessment.mockResolvedValue(
      assessment({
        status: "RELEASED",
        releasedAt:
          new Date("2026-10-05T21:00:00.000Z"),
      }),
    );

    const response = await POST(
      request(),
      context(),
    );

    expect(response.status).toBe(409);

    const body = await response.json();

    expect(body).toMatchObject({
      ok: false,
      code: "FRAMEWORK_RELEASE_ALREADY_CONFIRMED",
    });

    expect(
      mocks.updateTruvernFrameworkAssessment,
    ).not.toHaveBeenCalled();

    expect(
      mocks.insertGovernanceAuditLog,
    ).not.toHaveBeenCalled();

    expect(
      mocks.transaction,
    ).not.toHaveBeenCalled();
  });
});