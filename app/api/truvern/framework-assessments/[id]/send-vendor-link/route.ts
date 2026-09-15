import { NextResponse } from "next/server";
import { requireReviewerAccess } from "@/lib/auth/truvern-governance";
import { sendFrameworkAssessmentVendorLink } from "@/lib/communications/framework-assessment-vendor-link";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type Params = {
  params: Promise<{ id: string }> | { id: string };
};

function parseId(value: unknown) {
  const n = Number(String(value ?? "").trim());
  return Number.isFinite(n) && n > 0
    ? Math.floor(n)
    : null;
}

function normalizeEmails(value: unknown) {
  if (!Array.isArray(value)) return [];

  return Array.from(
    new Set(
      value
        .map((v) =>
          String(v || "").trim().toLowerCase(),
        )
        .filter(Boolean),
    ),
  );
}

export async function POST(
  req: Request,
  { params }: Params,
) {
  await requireReviewerAccess();

  const resolved = await params;
  const assessmentId =
    parseId(resolved.id);

  if (!assessmentId) {
    return NextResponse.json(
      {
        ok: false,
        error: "Invalid assessment id.",
      },
      { status: 400 },
    );
  }

  const body =
    await req.json().catch(() => ({}));

  const recipients =
    normalizeEmails(body.recipients);

  if (!recipients.length) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "At least one recipient is required.",
      },
      { status: 400 },
    );
  }

  try {
    const result =
      await sendFrameworkAssessmentVendorLink({
        assessmentId,
        recipients,
        mode: "MANUAL_RESEND",
      });

    return NextResponse.json({
      ok: true,
      provider: result.provider,
      recipients: result.recipients,
      vendorUrl: result.vendorUrl,
      assessmentId:
        result.assessmentId,
      communication: {
        mailboxId:
          result.mailboxId,
        conversationId:
          result.conversationId,
        messageId:
          result.messageId,
        providerMessageId:
          result.providerMessageId,
        simulated:
          result.simulated,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to send framework assessment.";

    const status =
      message ===
      "Framework assessment not found."
        ? 404
        : message ===
            "Framework assessment is not linked to an organization."
          ? 409
          : message ===
              "At least one recipient is required."
            ? 400
            : 500;

    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status },
    );
  }
}