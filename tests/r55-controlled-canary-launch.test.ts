import fs from "node:fs";
import path from "node:path";
import {
  describe,
  expect,
  it,
} from "vitest";

const repoRoot =
  process.cwd();

function read(relativePath: string): string {
  return fs.readFileSync(
    path.join(repoRoot, relativePath),
    "utf8",
  );
}

describe(
  "R55 controlled commercial canary launch",
  () => {
    const service =
      read(
        "lib/services/assessment-launch-service.ts",
      );

    const canaryRoute =
      read(
        "app/api/truvern/ops/r55-commercial-canary-launch/route.ts",
      );

    const ordinaryVendorLaunchRoute =
      read(
        "app/api/vendors/[id]/assessments/route.ts",
      );

    it(
      "adds assessment snapshot recipient overrides to the shared launch service",
      () => {
        expect(service).toContain(
          "vendorEmailOverride?: string | null;",
        );

        expect(service).toContain(
          "vendorContactNameOverride?: string | null;",
        );
      },
    );

    it(
      "disables existing-assessment reuse whenever a snapshot override is supplied",
      () => {
        expect(service).toContain(
          "const hasVendorSnapshotOverride =",
        );

        expect(service).toContain(
          "input.vendorEmailOverride !== undefined ||",
        );

        expect(service).toContain(
          "input.vendorContactNameOverride !== undefined;",
        );

        expect(service).toContain(
          "existingAssessment?.token &&",
        );

        expect(service).toContain(
          "!hasVendorSnapshotOverride",
        );
      },
    );

    it(
      "writes override values only into the assessment snapshot",
      () => {
        expect(service).toContain(
          "vendorEmail:",
        );

        expect(service).toContain(
          "input.vendorEmailOverride !== undefined",
        );

        expect(service).toContain(
          "input.vendorEmailOverride?.trim().toLowerCase() || null",
        );

        expect(service).toContain(
          "vendorContactName:",
        );

        expect(service).toContain(
          "input.vendorContactNameOverride !== undefined",
        );

        expect(service).toContain(
          "input.vendorContactNameOverride?.trim() || null",
        );

        expect(service).not.toContain(
          "prisma.vendor.update",
        );
      },
    );

    it(
      "does not expose controlled-recipient overrides through the ordinary vendor assessment API",
      () => {
        expect(
          ordinaryVendorLaunchRoute,
        ).not.toContain(
          "vendorEmailOverride",
        );

        expect(
          ordinaryVendorLaunchRoute,
        ).not.toContain(
          "vendorContactNameOverride",
        );

        expect(
          ordinaryVendorLaunchRoute,
        ).not.toContain(
          "recipientEmail",
        );
      },
    );

    it(
      "keeps the canary endpoint POST-only and Ops-gated",
      () => {
        expect(canaryRoute).toContain(
          "export async function POST",
        );

        expect(canaryRoute).not.toContain(
          "export async function GET",
        );

        expect(canaryRoute).not.toContain(
          "export async function PUT",
        );

        expect(canaryRoute).not.toContain(
          "export async function PATCH",
        );

        expect(canaryRoute).not.toContain(
          "export async function DELETE",
        );

        expect(canaryRoute).toContain(
          "await isTruvernOperator()",
        );

        expect(canaryRoute).toContain(
          '"CREATE-R55-CONTROLLED-ASSESSMENT"',
        );
      },
    );

    it(
      "requires a pristine canary identity before assessment launch",
      () => {
        expect(canaryRoute).toContain(
          "existingAssessmentCount !== 0",
        );

        expect(canaryRoute).toContain(
          "activeAssignmentCount !== 0",
        );

        expect(canaryRoute).toContain(
          "Controlled canary requires zero existing matching assessments.",
        );

        expect(canaryRoute).toContain(
          "Controlled canary requires zero active review assignments.",
        );
      },
    );

    it(
      "passes the controlled recipient only through the assessment snapshot override",
      () => {
        expect(canaryRoute).toContain(
          "vendorEmailOverride:",
        );

        expect(canaryRoute).toContain(
          "recipientEmail",
        );

        expect(canaryRoute).toContain(
          "vendorContactNameOverride:",
        );

        expect(canaryRoute).toContain(
          "recipientName",
        );

        expect(canaryRoute).toContain(
          "if (result.reused)",
        );
      },
    );

    it(
      "does not create review lifecycle, reserve credits, mutate Vendor, or send communication",
      () => {
        const forbidden = [
          "sendAssessmentVendorLink",
          "sendCommunication",
          "reserveTruvernReviewCredits",
          "consumeTruvernReviewCredits",
          "reverseTruvernReview",
          "prisma.reviewRequest.create",
          "prisma.reviewAssignment.create",
          "prisma.truvernCreditLedgerEntry.create",
          "prisma.vendor.update",
          "prisma.vendorContact.create",
          "prisma.vendorContact.update",
          "prisma.vendorContact.delete",
        ];

        for (const token of forbidden) {
          expect(canaryRoute).not.toContain(
            token,
          );
        }
      },
    );
  },
);