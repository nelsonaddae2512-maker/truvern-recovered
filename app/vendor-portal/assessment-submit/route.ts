import { NextResponse } from "next/server";
import {
  createOrgNotification,
} from "@/lib/notifications/create-notification";
import {
  submitAssessment,
} from "@/lib/services/assessment-submit-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: Request) {
  try {
    const body =
      await req.json().catch(() => null);

    const assessmentId =
      Number(body?.assessmentId);

    const vendorId =
      Number(body?.vendorId);

    const token =
      String(body?.token ?? "").trim();

    const result =
      await submitAssessment({
        assessmentId,
        vendorId,
        token,
      });

    if (!result.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: result.error,
          ...(result.missingQuestionIds
            ? {
                missingQuestionIds:
                  result.missingQuestionIds,
                missingCount:
                  result.missingCount,
              }
            : {}),
        },
        {
          status: result.status,
        },
      );
    }

    /*
     * Notifications and scoring are route-level
     * side effects. They run only for the first
     * successful submission, not for idempotent retries.
     */
    if (!result.alreadySubmitted) {
      try {
        await createOrgNotification({
          organizationId:
            result.assessment.organizationId,
          type: "VENDOR_SUBMITTED",
          severity: "INFO",
          title:
            `Vendor review submitted - Vendor #${result.assessment.vendorId}`,
          message:
            "A vendor completed and submitted an assessment for governance review.",
          href: "/review-desk",
          metadataJson: {
            assessmentId:
              result.assessment.id,
            vendorId:
              result.assessment.vendorId,
            source: "vendor_portal",
          },
        });
      } catch (error) {
        console.error(
          "Failed to create vendor submission notification",
          error,
        );
      }

      try {
        await fetch(
          `${
            process.env.NEXT_PUBLIC_APP_URL ??
            "http://localhost:3000"
          }/api/truvern/framework-assessments/${
            result.assessment.id
          }/score`,
          {
            method: "POST",
          },
        );
      } catch (error) {
        console.error(
          "Failed to score assessment",
          error,
        );
      }
    }

    return NextResponse.json({
      ok: true,
      ...(result.alreadySubmitted
        ? {
            alreadySubmitted: true,
          }
        : {}),
      assessment: result.assessment,
      synchronizedRunCount:
        result.synchronizedRunCount,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to submit assessment.";

    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      {
        status: 500,
      },
    );
  }
}
