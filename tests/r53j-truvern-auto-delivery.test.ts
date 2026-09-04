import fs from "node:fs";
import path from "node:path";
import {
  describe,
  expect,
  it,
} from "vitest";

function readSource(relativePath: string) {
  return fs.readFileSync(
    path.join(process.cwd(), relativePath),
    "utf8",
  );
}

describe(
  "R53J Truvern automatic vendor delivery contract",
  () => {
    it(
      "keeps automatic delivery outside the assignment transaction",
      () => {
        const source = readSource(
          "app/api/review-desk/assignments/route.ts",
        );

        const transactionStart =
          source.indexOf(
            "const result = await prisma.$transaction",
          );

        const transactionResultEnd =
          source.indexOf(
            "if (\n      result.status === 200 &&\n      result.body.mode === \"truvern\"",
          );

        const deliveryCall =
          source.indexOf(
            "await sendAssessmentVendorLink({",
            transactionResultEnd,
          );

        expect(transactionStart).toBeGreaterThan(-1);
        expect(transactionResultEnd).toBeGreaterThan(
          transactionStart,
        );
        expect(deliveryCall).toBeGreaterThan(
          transactionResultEnd,
        );
      },
    );

    it(
      "uses AUTO_ONCE for automatic Truvern delivery",
      () => {
        const source = readSource(
          "app/api/review-desk/assignments/route.ts",
        );

        expect(source).toContain(
          'mode:\n              "AUTO_ONCE"',
        );
      },
    );

    it(
      "preserves committed review creation when automatic delivery fails",
      () => {
        const source = readSource(
          "app/api/review-desk/assignments/route.ts",
        );

        expect(source).toContain(
          '"TRUVERN_ASSIGNMENT_VENDOR_DELIVERY_ERROR"',
        );

        expect(source).toContain(
          "vendorDelivery: {",
        );

        expect(source).toContain(
          "failed: true",
        );

        expect(source).toContain(
          "Truvern Review was created, but the vendor invitation could not be delivered automatically.",
        );

        const deliveryCatch =
          source.indexOf(
            "} catch (deliveryError) {",
          );

        const successfulAssignmentResponse =
          source.indexOf(
            "return json(result.status, {",
            deliveryCatch,
          );

        const outerAssignmentCatch =
          source.indexOf(
            "} catch (error) {",
            successfulAssignmentResponse,
          );

        expect(deliveryCatch).toBeGreaterThan(-1);

        expect(
          successfulAssignmentResponse,
        ).toBeGreaterThan(deliveryCatch);

        expect(outerAssignmentCatch).toBeGreaterThan(
          successfulAssignmentResponse,
        );
      },
    );

    it(
      "keeps manual vendor-link requests as MANUAL_RESEND",
      () => {
        const source = readSource(
          "app/api/assessments/[id]/send-vendor-link/route.ts",
        );

        expect(source).toMatch(
          /mode:\s*"MANUAL_RESEND"/,
        );
      },
    );

    it(
      "implements automatic duplicate suppression in the shared service",
      () => {
        const source = readSource(
          "lib/communications/assessment-vendor-link.ts",
        );

        expect(source).toContain(
          '"AUTO_ONCE"',
        );

        expect(source).toContain(
          '"MANUAL_RESEND"',
        );

        expect(source).toContain(
          "alreadySent",
        );

        expect(source).toContain(
          "QUEUED",
        );

        expect(source).toContain(
          "SENT",
        );

        expect(source).toContain(
          "DELIVERED",
        );

        expect(source).toContain(
          "sendCommunication(",
        );
      },
    );

    it(
      "returns successful delivery metadata on the assignment response",
      () => {
        const source = readSource(
          "app/api/review-desk/assignments/route.ts",
        );

        expect(source).toContain(
          "sent:\n              vendorDelivery.sent",
        );

        expect(source).toContain(
          "alreadySent:\n              vendorDelivery.alreadySent",
        );

        expect(source).toContain(
          "failed: false",
        );

        expect(source).toContain(
          "error: null",
        );
      },
    );
  },
);