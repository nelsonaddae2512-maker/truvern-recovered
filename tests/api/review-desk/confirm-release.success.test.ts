import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createJsonRequest,
  createRouteContext,
  readJsonResponse,
} from "@/tests/support/http";

const mocks = vi.hoisted(() => ({
  auth: vi.fn<() => Promise<{ userId: string | null }>>(),
  requireDbOrganization: vi.fn<() => Promise<{ id: number }>>(),
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
    $queryRawUnsafe: mocks.queryRawUnsafe,
    $executeRawUnsafe: mocks.executeRawUnsafe,
  },
}));

vi.mock("@/lib/org-db", () => ({
  requireDbOrganization: mocks.requireDbOrganization,
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

type SuccessBody = {
  ok: true;
  responseId: number;
  releaseState: "CONFIRMED";
  checksum: string;
  creditConsumption: {
    consumed: boolean;
    alreadyConsumed: boolean;
    reservedCredits: number;
    eventKey: string;
  };
};

function sqlOf(call: unknown[]): string {
  return String(call[0] ?? "");
}

describe("confirm-release successful governance transaction", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.auth.mockResolvedValue({
      userId: "user_customer_1",
    });

    mocks.requireDbOrganization.mockResolvedValue({
      id: 7,
    });

    mocks.executeRawUnsafe.mockResolvedValue(1);
    mocks.createOrgNotification.mockResolvedValue();
    mocks.maybePersistTransparencyCheckpoint.mockResolvedValue();

    mocks.signGovernancePayload.mockReturnValue({
      algorithm: "HMAC-SHA256",
      keyId: "test-key",
      signature: "signed-governance-payload",
    });

    mocks.createGovernanceNotarizationReceipt.mockReturnValue({
      receiptId: "receipt-test-1",
      ledgerHash: "ledger-hash-test-1",
      timestamp: "2026-07-24T18:10:00.000Z",
    });

    mocks.generateLedgerEntry.mockReturnValue({
      entryId: "entry-test-1",
      assignmentId: 42,
      responseId: 101,
      checksum: "CHECKSUM",
      ledgerHash: "ledger-hash-test-1",
      receiptId: "receipt-test-1",
      timestamp: "2026-07-24T18:10:00.000Z",
      previousEntryHash: "previous-entry",
      entryHash: "entry-hash-test-1",
    });

    mocks.getReviewEvidence.mockResolvedValue([
      {
        id: 501,
        filename: "soc2-report.pdf",
      },
    ]);

    mocks.buildEvidenceSnapshot.mockReturnValue({
      schema: "truvern.evidence_snapshot.v1",
      manifest: {
        artifactCount: 1,
      },
      artifacts: [
        {
          id: 501,
          filename: "soc2-report.pdf",
        },
      ],
    });

    mocks.checksumJson.mockReturnValue(
      "EVIDENCE-MANIFEST-CHECKSUM",
    );

    mocks.buildCanonicalGovernanceArtifact.mockReturnValue({
      schema: "truvern.canonical_governance_artifact.v1",
      executiveSummary: "Executive summary",
      finalAssessment: "Approved with conditions",
    });

    mocks.buildGovernanceReleasePackage.mockReturnValue({
      schema: "truvern.governance_release_package.v1",
      immutable: true,
      releaseState: "CONFIRMED",
    });
  });

  it("confirms a released Truvern review and persists all immutable release artifacts", async () => {
    mocks.queryRawUnsafe
      .mockResolvedValueOnce([
        {
          id: 42,
          organizationId: 7,
          vendorId: 11,
          vendorName: "Acme Vendor",
          assignmentType: "TRUVERN",
          reviewerName: "Truvern Reviewer",
          reviewRequestId: 88,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 101,
          reviewAssignmentId: 42,
          responses: {
            releaseState: "RELEASED",
            decision: "APPROVED_WITH_CONDITIONS",
            riskLevel: "MODERATE",
            findings:
              "EXECUTIVE SUMMARY\nExecutive summary\n" +
              "TRUVERN GOVERNANCE REVIEW\nApproved with conditions\n" +
              "CONDITIONS & FOLLOW-UPS\nAnnual SOC 2 renewal",
            structuredAssessment: {
              executiveSummary: "Executive summary",
              finalAssessment: "Approved with conditions",
              conditionsAndFollowUps: [
                "Annual SOC 2 renewal",
              ],
              frameworkName:
                "Truvern NIST 800-53 Governance Review",
              questionnaireReview: {
                submittedAnswers: 120,
              },
              boardSummary: "Board summary",
              customerSummary: "Customer summary",
              truvernReviewerIntelligence: {
                findings: [
                  {
                    title: "Evidence renewal",
                    severity: "MEDIUM",
                  },
                ],
              },
            },
          },
        },
      ])
      .mockResolvedValueOnce([
        {
          entryHash: "previous-entry",
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 301,
          title: "Annual SOC 2 renewal",
          status: "OPEN",
          kind: "ATTESTATION",
          dueAt: "2027-07-24T00:00:00.000Z",
          fulfilledAt: null,
          createdAt: "2026-07-24T18:00:00.000Z",
          updatedAt: "2026-07-24T18:00:00.000Z",
        },
      ])
      .mockResolvedValueOnce([
        {
          count: 0,
        },
      ])
      .mockResolvedValueOnce([
        {
          reservedCredits: 1,
        },
      ]);

    const request = createJsonRequest(
      "http://localhost/api/review-desk/reviews/42/confirm-release",
      {
        body: {
          acceptedAcknowledgement: true,
          acknowledgementType:
            "CUSTOMER_RELEASE_CONFIRMATION",
        },
      },
    );

    const result = await POST(
      request,
      createRouteContext({ id: "42" }),
    );

    const body = await readJsonResponse<SuccessBody>(result);

    expect(result.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.responseId).toBe(101);
    expect(body.releaseState).toBe("CONFIRMED");
    expect(body.checksum).toMatch(/^[A-F0-9]{24}$/);
    expect(body.creditConsumption).toEqual({
      consumed: true,
      alreadyConsumed: false,
      reservedCredits: 1,
      eventKey: "review:42:consumption",
    });

    expect(mocks.signGovernancePayload).toHaveBeenCalledOnce();
    expect(
      mocks.createGovernanceNotarizationReceipt,
    ).toHaveBeenCalledOnce();
    expect(mocks.generateLedgerEntry).toHaveBeenCalledOnce();
    expect(
      mocks.maybePersistTransparencyCheckpoint,
    ).toHaveBeenCalledOnce();

    expect(mocks.getReviewEvidence).toHaveBeenCalledWith(42);
    expect(mocks.buildEvidenceSnapshot).toHaveBeenCalledOnce();
    expect(mocks.checksumJson).toHaveBeenCalledWith({
      artifactCount: 1,
    });

    expect(
      mocks.buildCanonicalGovernanceArtifact,
    ).toHaveBeenCalledOnce();
    expect(
      mocks.buildGovernanceReleasePackage,
    ).toHaveBeenCalledOnce();

    const responseUpdate = mocks.executeRawUnsafe.mock.calls.find(
      (call) =>
        sqlOf(call).includes('update "ReviewResponse"'),
    );

    expect(responseUpdate).toBeDefined();

    const persistedResponses = JSON.parse(
      String(responseUpdate?.[1]),
    ) as Record<string, any>;

    expect(persistedResponses.releaseState).toBe("CONFIRMED");
    expect(
      persistedResponses.customerAcknowledgement,
    ).toMatchObject({
      accepted: true,
      acceptedByUserId: "user_customer_1",
      acceptedByOrganizationId: 7,
      acceptanceVersion: "TRV-LEGAL-1.0",
      acknowledgementType:
        "CUSTOMER_RELEASE_CONFIRMATION",
    });

    expect(
      persistedResponses.governanceReleaseSnapshot,
    ).toMatchObject({
      assignmentId: 42,
      responseId: 101,
      vendorId: 11,
      vendorName: "Acme Vendor",
      releaseState: "CONFIRMED",
      decision: "APPROVED_WITH_CONDITIONS",
      riskLevel: "MODERATE",
      evidenceManifestChecksum:
        "EVIDENCE-MANIFEST-CHECKSUM",
      evidenceSummary: {
        artifactCount: 1,
      },
      remediationSnapshot: {
        remediationCount: 1,
        remediationOpenCount: 1,
        remediationApprovedCount: 0,
        remediationRejectedCount: 0,
      },
      governanceSeal: {
        version: "TRV-GOV-SEAL-1.0",
        algorithm: "SHA-256",
        notarizationReceipt: {
          receiptId: "receipt-test-1",
        },
        transparencyLedgerEntry: {
          entryId: "entry-test-1",
        },
      },
    });

    const sqlStatements =
      mocks.executeRawUnsafe.mock.calls.map(sqlOf);

    expect(
      sqlStatements.some((sql) =>
        sql.includes(
          'insert into "GovernanceTransparencyLog"',
        ),
      ),
    ).toBe(true);

    expect(
      sqlStatements.some((sql) =>
        sql.includes(
          'insert into "VendorGovernanceMemory"',
        ),
      ),
    ).toBe(true);

    expect(
      sqlStatements.some((sql) =>
        sql.includes(
          'insert into "TruvernCreditLedgerEntry"',
        ),
      ),
    ).toBe(true);

    expect(
      sqlStatements.some((sql) =>
        sql.includes(
          'insert into "GovernanceReleaseManifest"',
        ),
      ),
    ).toBe(true);

    expect(mocks.executeRawUnsafe).toHaveBeenCalledTimes(5);

    expect(mocks.createOrgNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 7,
        type: "TRUVERN_RELEASED",
        severity: "SUCCESS",
        href: "/review-desk/reviews/42",
        metadataJson: expect.objectContaining({
          assignmentId: 42,
          source: "confirm_release",
        }),
      }),
    );
  });
});
