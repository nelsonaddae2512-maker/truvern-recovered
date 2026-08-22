import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { requireDbOrganization } from "@/lib/org-db";
import {
  COMMUNICATION_MAILBOX_KEYS,
  sendCommunication,
} from "@/lib/communications";
import { findAssessment } from "@/lib/repositories/assessment-repository";
import { findReviewAssignment } from "@/lib/repositories/review-assignment-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
async function requireApiAuth() {
  const { userId } = await auth();

  if (!userId) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401, headers: { "cache-control": "no-store" } },
      ),
    };
  }

  try {
    const org = await requireDbOrganization();

    return {
      ok: true as const,
      userId,
      org,
    };
  } catch {
    return {
      ok: false as const,
      response: NextResponse.json(
        { ok: false, error: "Organization required" },
        { status: 403, headers: { "cache-control": "no-store" } },
      ),
    };
  }
}

type Params = {
  params: Promise<{ id: string }> | { id: string };
};

function parseId(value: unknown) {
  const n = Number(String(value ?? "").trim());
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

function normalizeEmails(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value
    .map((v) => String(v || "").trim().toLowerCase())
    .filter(Boolean);
}

export async function POST(req: Request, { params }: Params) {
  const gate = await requireApiAuth();

  if (!gate.ok) {
    return gate.response;
  }

try {
    const resolvedParams = await params;
    const assessmentId = parseId(resolvedParams.id);

    if (!assessmentId) {
      return NextResponse.json(
        { ok: false, error: "Invalid assessment id." },
        { status: 400 },
      );
    }

    const body = await req.json().catch(() => ({}));
    const recipients = normalizeEmails(body.recipients);

    if (!recipients.length) {
      return NextResponse.json(
        { ok: false, error: "At least one recipient is required." },
        { status: 400 },
      );
    }

    const assessment = await findAssessment({
      where: { id: assessmentId },
      select: {
        id: true,
        title: true,
        token: true,
        dueAt: true,
        organizationId: true,
        vendorId: true,
        reviewAssignmentId: true,
        vendor: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!assessment) {
      return NextResponse.json(
        { ok: false, error: "Assessment not found." },
        { status: 404 },
      );
    }
    const reviewAssignment =
      assessment.reviewAssignmentId
        ? await findReviewAssignment({
            where: {
              id: assessment.reviewAssignmentId,
            },
            select: {
              id: true,
              organizationId: true,
              vendorId: true,
              reviewRequestId: true,
            },
          })
        : null;

    const linkedReviewAssignment =
      reviewAssignment &&
      reviewAssignment.organizationId ===
        assessment.organizationId &&
      reviewAssignment.vendorId ===
        assessment.vendorId
        ? reviewAssignment
        : null;

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      "http://localhost:3000";

    const vendorUrl =
      `${appUrl}/vendor-assessment/${assessment.token}`;

    const dueDate = assessment.dueAt
      ? new Intl.DateTimeFormat("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        }).format(assessment.dueAt)
      : "No due date";
    const subject =
      `Vendor review request: ${assessment.title}`;

    const html = `
      <div style="font-family:Inter,Arial,sans-serif;line-height:1.6;color:#111827">
        <h2>Vendor review request</h2>

        <p>
          Truvern has requested completion of the following assessment.
        </p>

        <table cellpadding="8" cellspacing="0" border="0">
          <tr>
            <td><strong>Assessment</strong></td>
            <td>${assessment.title}</td>
          </tr>

          <tr>
            <td><strong>Vendor</strong></td>
            <td>${assessment.vendor?.name || "Vendor"}</td>
          </tr>

          <tr>
            <td><strong>Due date</strong></td>
            <td>${dueDate}</td>
          </tr>
        </table>

        <p style="margin-top:24px">
          <a
            href="${vendorUrl}"
            style="
              background:#06b6d4;
              color:white;
              padding:12px 18px;
              text-decoration:none;
              border-radius:10px;
              display:inline-block;
              font-weight:600;
            "
          >
            Open assessment
          </a>
        </p>

        <p style="margin-top:24px;font-size:14px;color:#6b7280">
          Secure assessment link:
          <br />
          ${vendorUrl}
        </p>
      </div>
    `;

    const result = await sendCommunication({
      organizationId: assessment.organizationId,
      mailboxKey:
        COMMUNICATION_MAILBOX_KEYS.ASSESSMENTS,
      to: recipients.join(", "),
      subject,
      html,
      priority: "NORMAL",
      channel: "EMAIL",
      externalThreadId:
        `assessment:${assessment.id}:vendor-link`,
      context: {
        organizationId:
          assessment.organizationId,
        vendorId: assessment.vendorId,
        assessmentId: assessment.id,
        reviewRequestId:
          linkedReviewAssignment?.reviewRequestId ?? null,
        reviewAssignmentId:
          linkedReviewAssignment?.id ?? null,
      },
    });

    return NextResponse.json({
      ok: true,
      provider: result.provider,
      recipients,
      communication: {
        mailboxId: result.mailboxId,
        conversationId: result.conversationId,
        messageId: result.messageId,
        providerMessageId:
          result.providerMessageId,
        simulated: result.simulated,
      },
    });
  } catch (error: any) {
    console.error(error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error?.message ||
          "Failed to send vendor review email.",
      },
      { status: 500 },
    );
  }
}





