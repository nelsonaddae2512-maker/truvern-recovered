import {
  describe,
  expect,
  it,
} from "vitest";

import {
  buildCisoReportProjection,
  CISO_REPORT_TITLE,
  CISO_REPORT_VERSION,
} from "../lib/governance/ciso-report";

describe(
  "R57 CISO report projection",
  () => {
    it(
      "projects the immutable executive governance contract",
      () => {
        const report =
          buildCisoReportProjection({
            assignmentId: 42,
            vendorName: "Example Vendor",
            vendorCategory: "SaaS",
            evidenceCount: 7,
            governanceReleasePackage: {
              decision:
                "APPROVE_WITH_CONDITIONS",
              riskLevel:
                "HIGH",
              metadata: {
                releaseState:
                  "RELEASED",
              },
              executiveSummary:
                "Material control weaknesses require governed follow-up.",
              finalRecommendation:
                "Approve with conditions.",
              conditionsAndFollowUps: [
                "Close critical findings.",
                "Provide updated evidence.",
              ],
            },
          });

        expect(report.schema)
          .toBe(CISO_REPORT_VERSION);

        expect(report.title)
          .toBe(CISO_REPORT_TITLE);

        expect(report.assignmentId)
          .toBe(42);

        expect(report.vendorName)
          .toBe("Example Vendor");

        expect(report.residualRisk)
          .toBe("HIGH");

        expect(report.releaseState)
          .toBe("RELEASED");

        expect(report.evidenceSummary.artifactCount)
          .toBe(7);

        expect(
          report.conditionsAndFollowUps,
        ).toHaveLength(2);
      },
    );

    it(
      "summarizes finding severity and open posture",
      () => {
        const report =
          buildCisoReportProjection({
            assignmentId: 10,
            governanceReleasePackage: {
              findings: [
                {
                  title:
                    "Critical access weakness",
                  severity:
                    "CRITICAL",
                  status:
                    "OPEN",
                },
                {
                  title:
                    "Logging gap",
                  severity:
                    "HIGH",
                  status:
                    "REMEDIATED",
                },
                {
                  title:
                    "Policy gap",
                  severity:
                    "MODERATE",
                  status:
                    "OPEN",
                },
              ],
            },
          });

        expect(report.findingSummary)
          .toEqual({
            total: 3,
            open: 2,
            critical: 1,
            high: 1,
            moderate: 1,
            low: 0,
            informational: 0,
            unknown: 0,
          });
      },
    );

    it(
      "does not invent control-family mappings from control identifiers",
      () => {
        const report =
          buildCisoReportProjection({
            assignmentId: 11,
            governanceReleasePackage: {
              findings: [
                {
                  controlId:
                    "AC-2",
                  title:
                    "Account management weakness",
                  severity:
                    "HIGH",
                },
              ],
            },
          });

        expect(
          report.controlFamilyCoverage,
        ).toBe("NOT_RECORDED");

        expect(report.controlFamilies)
          .toEqual([]);
      },
    );

    it(
      "evaluates remediation overdue posture against an immutable as-of timestamp",
      () => {
        const report =
          buildCisoReportProjection({
            assignmentId: 13,
            asOf:
              "2026-09-01T00:00:00.000Z",
            remediation: [
              {
                status:
                  "REQUESTED",
                dueAt:
                  "2026-08-31T23:59:59.000Z",
              },
              {
                status:
                  "REQUESTED",
                dueAt:
                  "2026-09-02T00:00:00.000Z",
              },
              {
                status:
                  "COMPLETED",
                dueAt:
                  "2026-08-01T00:00:00.000Z",
              },
            ],
          });

        expect(
          report.remediationSummary.overdue,
        ).toBe(1);
      },
    );
    it(
      "uses explicit family data when the immutable finding carries it",
      () => {
        const report =
          buildCisoReportProjection({
            assignmentId: 12,
            remediation: [
              {
                status:
                  "REQUESTED",
              },
              {
                status:
                  "COMPLETED",
              },
            ],
            attestations: [
              {
                status:
                  "OPEN",
              },
            ],
            governanceReleasePackage: {
              findings: [
                {
                  controlFamily:
                    "Access Control",
                  title:
                    "Access weakness",
                  severity:
                    "HIGH",
                },
                {
                  controlFamily:
                    "Access Control",
                  title:
                    "Privilege weakness",
                  severity:
                    "CRITICAL",
                },
              ],
            },
          });

        expect(
          report.controlFamilyCoverage,
        ).toBe("RECORDED");

        expect(report.controlFamilies)
          .toEqual([
            {
              family:
                "Access Control",
              findingCount:
                2,
              critical:
                1,
              high:
                1,
              moderate:
                0,
              low:
                0,
            },
          ]);

        expect(
          report.remediationSummary.total,
        ).toBe(2);

        expect(
          report.remediationSummary.open,
        ).toBe(1);

        expect(
          report.attestationSummary.open,
        ).toBe(1);
      },
    );
  },
);