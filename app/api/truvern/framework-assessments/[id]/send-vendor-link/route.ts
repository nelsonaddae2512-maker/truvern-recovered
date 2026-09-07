import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { generateVendorFrameworkAssessmentToken } from "@/lib/auth/vendor-framework-assessment-token";
import {
  COMMUNICATION_MAILBOX_KEYS,
  sendCommunication,
} from "@/lib/communications";
import { requireReviewerAccess } from "@/lib/auth/truvern-governance";
import { findTruvernFramework } from "@/lib/repositories/truvern-framework-repository";
import { findTruvernFrameworkAssessment } from "@/lib/repositories/truvern-framework-assessment-repository";
import { findVendor } from "@/lib/repositories/vendor-repository";
import { findReviewAssignment } from "@/lib/repositories/review-assignment-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

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
  await requireReviewerAccess();

  const resolved = await params;
  const assessmentId = parseId(resolved.id);

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

  const assessment = await findTruvernFrameworkAssessment({
    where: { id: assessmentId },
  });

  if (!assessment) {
    return NextResponse.json(
      { ok: false, error: "Framework assessment not found." },
      { status: 404 },
    );
  }

  if (!assessment.organizationId) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Framework assessment is not linked to an organization.",
      },
      { status: 409 },
    );
  }

  const vendor = assessment.vendorId
    ? await findVendor({
        where: { id: assessment.vendorId },
        select: { name: true },
      })
    : null;

  const framework = await findTruvernFramework({
    where: { id: assessment.frameworkId },
    select: {
      name: true,
      version: true,
    },
  });
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
    (
      assessment.vendorId == null ||
      reviewAssignment.vendorId ===
        assessment.vendorId
    )
      ? reviewAssignment
      : null;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  let vendorToken = assessment.vendorToken;

  if (!vendorToken) {
    for (let attempt = 0; attempt < 3 && !vendorToken; attempt += 1) {
      const candidateToken = generateVendorFrameworkAssessmentToken();

      try {
        const claimed = await prisma.truvernFrameworkAssessment.updateMany({
          where: {
            id: assessment.id,
            vendorToken: null,
          },
          data: {
            vendorToken: candidateToken,
          },
        });

        if (claimed.count === 1) {
          vendorToken = candidateToken;
          break;
        }

        const current = await prisma.truvernFrameworkAssessment.findUnique({
          where: { id: assessment.id },
          select: { vendorToken: true },
        });

        vendorToken = current?.vendorToken ?? null;
      } catch (error) {
        const code =
          typeof error === "object" &&
          error !== null &&
          "code" in error
            ? String((error as { code?: unknown }).code ?? "")
            : "";

        if (code !== "P2002") {
          throw error;
        }
      }
    }
  }

  if (!vendorToken) {
    return NextResponse.json(
      {
        ok: false,
        error: "Unable to establish secure vendor assessment access.",
      },
      { status: 500 },
    );
  }

  const vendorUrl = `${appUrl}/vendor-framework-assessment/${vendorToken}`;

  const subject = `Vendor governance assessment request - ${assessment.title}`;

  const html = `
    <div style="font-family:Inter,Arial,sans-serif;line-height:1.6;color:#111827">
      <h2>Vendor governance assessment request</h2>

      <p>
        Truvern has requested completion of a governance assessment for
        vendor review.
      </p>

      <table cellpadding="8" cellspacing="0" border="0">
        <tr>
          <td><strong>Assessment</strong></td>
          <td>${assessment.title}</td>
        </tr>

        <tr>
          <td><strong>Vendor</strong></td>
          <td>${vendor?.name || "Vendor"}</td>
        </tr>

        <tr>
          <td><strong>Framework</strong></td>
          <td>${framework?.name || "Governance framework"} ${framework?.version || ""}</td>
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

      <p style="margin-top:24px;font-size:13px;color:#6b7280">
        Truvern governance reviews are operational assessments and are not
        certifications, legal guarantees, or regulatory warranties.
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
      `truvern-framework-assessment:${assessment.id}:vendor-link`,
    context: {
      organizationId: assessment.organizationId,
      vendorId: assessment.vendorId,
      assessmentId: assessment.id,
      assessmentRunId: assessment.assessmentRunId,
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
    vendorUrl,
    assessmentId: assessment.id,
    communication: {
      mailboxId: result.mailboxId,
      conversationId: result.conversationId,
      messageId: result.messageId,
      providerMessageId:
        result.providerMessageId,
      simulated: result.simulated,
    },
  });
}
