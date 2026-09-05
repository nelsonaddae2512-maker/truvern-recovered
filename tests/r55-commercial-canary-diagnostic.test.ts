import {
  describe,
  expect,
  it,
} from "vitest";
import fs from "node:fs";
import path from "node:path";

const routePath =
  path.join(
    process.cwd(),
    "app/api/truvern/ops/diagnostics/r55-commercial-canary/route.ts",
  );

const source =
  fs.readFileSync(
    routePath,
    "utf8",
  );

describe(
  "R55 commercial canary diagnostic",
  () => {
    it("is GET-only and Ops-gated", () => {
      expect(source).toContain(
        "export async function GET",
      );

      expect(source).toContain(
        "isTruvernOperator",
      );

      expect(source).not.toMatch(
        /export\s+async\s+function\s+(POST|PUT|PATCH|DELETE)\b/,
      );
    });

    it("supports pre-assessment mode", () => {
      expect(source).toContain(
        '"organizationId"',
      );

      expect(source).toContain(
        '"vendorId"',
      );

      expect(source).toContain(
        '"templateId"',
      );

      expect(source).toContain(
        '"assessmentId"',
      );

      expect(source).toContain(
        '"PRE_ASSESSMENT"',
      );

      expect(source).toContain(
        '"POST_ASSESSMENT"',
      );

      expect(source).not.toContain(
        "A valid assessmentId is required.",
      );
    });

    it("uses commercial template selection", () => {
      expect(source).toContain(
        "readTruvernReviewTemplateSelection",
      );
    });

    it("mirrors AUTO_ONCE default recipients", () => {
      expect(source).toContain(
        "assessment?.vendorEmail",
      );

      expect(source).toContain(
        "vendor.contactEmail",
      );

      expect(source).toContain(
        "defaultDeliveryRecipients",
      );
    });

    it("uses production credit cost semantics", () => {
      expect(source).toContain(
        "TRUVERN_REVIEW_CREDIT_COST",
      );

      expect(source).toContain(
        "effectiveCreditCost === 1",
      );
    });

    it("checks pending lifecycle timestamps", () => {
      expect(source).toContain(
        "reviewerUserId: true",
      );

      expect(source).toContain(
        "startedAt: true",
      );

      expect(source).toContain(
        "claimedAt: true",
      );

      expect(source).toContain(
        "submittedAt: true",
      );

      expect(source).not.toContain(
        "assignedReviewerName: true",
      );

      expect(source).not.toContain(
        "reviewerName: true",
      );

      expect(source).not.toContain(
        "assignedTo: true",
      );
    });

    it("checks canonical AUTO_ONCE thread", () => {
      expect(source).toContain(
        "assessment:${assessment.id}:vendor-link",
      );

      expect(source).toContain(
        '"QUEUED"',
      );

      expect(source).toContain(
        '"SENT"',
      );

      expect(source).toContain(
        '"DELIVERED"',
      );
    });

    it("does not expose raw email response fields", () => {
      expect(source).toContain(
        "maskEmail",
      );

      expect(source).toContain(
        "rawEmailReturned: false",
      );

      expect(source).not.toContain(
        "contactEmail: vendor.contactEmail",
      );

      expect(source).not.toContain(
        "vendorEmail: row.vendorEmail",
      );
    });

    it("contains no write primitive", () => {
      expect(source).not.toMatch(
        /prisma\.[A-Za-z0-9_]+\.(create|update|delete|upsert|createMany|updateMany|deleteMany)\s*\(/,
      );

      expect(source).not.toMatch(
        /prisma\.\$(executeRaw|executeRawUnsafe|queryRawUnsafe)\b/,
      );

      expect(source).not.toContain(
        "prisma.$transaction",
      );
    });

    it("reports exact read-only credit ledger event baseline", () => {
      expect(source).toContain(
        "prisma.truvernCreditLedgerEntry.findMany",
      );

      expect(source).toContain(
        "creditLedgerEvents",
      );

      expect(source).toContain(
        "entryType: true",
      );

      expect(source).toContain(
        "availableDelta: true",
      );

      expect(source).toContain(
        "reservedDelta: true",
      );

      expect(source).toContain(
        "consumedDelta: true",
      );

      expect(source).toContain(
        "reviewAssignmentId: true",
      );

      expect(source).toContain(
        "reviewRequestId: true",
      );

      expect(source).toContain(
        "eventKey: true",
      );

      expect(source).toContain(
        "ledgerEvents:",
      );
    });

    it("classifies the exact normal-launch reuse candidate", () => {
      expect(source).toContain(
        "launchReuseSearchCandidate",
      );

      expect(source).toContain(
        "candidate.isVendorSubmitted === false",
      );

      expect(source).toContain(
        'candidate.status === "LAUNCHED"',
      );

      expect(source).toContain(
        'candidate.status === "IN_PROGRESS"',
      );

      expect(source).toContain(
        'candidate.status === "DRAFT"',
      );

      expect(source).toContain(
        "right.id - left.id",
      );

      expect(source).toContain(
        "launchReuseSearchCandidate?.token",
      );

      expect(source).toContain(
        "launchReuseCandidate:",
      );

      expect(source).toContain(
        "token: true",
      );

      expect(source).not.toContain(
        "token: launchReuseCandidate.token",
      );
    });
  },
);
