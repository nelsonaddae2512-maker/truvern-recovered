import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(process.cwd(), "app/review-desk/page.tsx"),
  "utf8",
);

const cardStart = source.indexOf(
  "function ManagedAssessmentQueueCard(",
);

const cardEnd = source.indexOf(
  "function ",
  cardStart + 10,
);

const card = source.slice(
  cardStart,
  cardEnd < 0 ? undefined : cardEnd,
);

describe("Review Desk card routing guardrails", () => {
  it("distinguishes intake assessments from review assignments", () => {
    expect(card).toContain(
      'assignmentType === "INTERNAL"',
    );
    expect(card).toContain(
      'assignmentType === "INTAKE"',
    );
  });

  it("uses assignment IDs only for existing reviews", () => {
    expect(card).toContain(
      'positiveId(row?.assignmentId ?? row?.id)',
    );
    expect(card).toContain(
      '`/review-desk/${assignmentId}`',
    );
  });

  it("routes intake records to the authorized start-review page", () => {
    expect(card).toContain(
      'positiveId(row?.assessmentId ?? row?.id)',
    );
    expect(card).toContain(
      'positiveId(row?.vendorId)',
    );
    expect(card).toContain(
      '`/review-desk/start-review?assessmentId=${assessmentId}&vendorId=${vendorId}`',
    );
  });

  it("does not generate actionable links for invalid identifiers", () => {
    expect(card).toContain("Number.isSafeInteger(id)");
    expect(card).toContain("id > 0");
    expect(card).toContain("{reviewHref ? (");
    expect(card).toContain('aria-disabled="true"');
  });

  it("uses an appropriate action label", () => {
    expect(card).toContain('"Start review"');
    expect(card).toContain('"Open review"');
    expect(card).toContain("{actionLabel}");
  });

  it("preserves tenant-scoped review listing", () => {
    expect(source).toContain(
      'and ra."organizationId" = v."organizationId"',
    );
    expect(source).toContain(
      'and v."organizationId" = ${organizationId}',
    );
    expect(source).toContain(
      'getCustomerOrganizationActor()',
    );
  });
});