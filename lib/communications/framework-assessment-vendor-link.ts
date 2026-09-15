import prisma from "@/lib/prisma";
import { generateVendorFrameworkAssessmentToken } from "@/lib/auth/vendor-framework-assessment-token";
import {
  COMMUNICATION_MAILBOX_KEYS,
  sendCommunication,
} from "@/lib/communications";
import { findTruvernFramework } from "@/lib/repositories/truvern-framework-repository";
import { findTruvernFrameworkAssessment } from "@/lib/repositories/truvern-framework-assessment-repository";
import { findVendor } from "@/lib/repositories/vendor-repository";
import { findReviewAssignment } from "@/lib/repositories/review-assignment-repository";

export type FrameworkAssessmentVendorLinkDeliveryMode =
  | "AUTO_ONCE"
  | "MANUAL_RESEND";

export type SendFrameworkAssessmentVendorLinkInput = {
  assessmentId: number;
  recipients?: string[];
  mode?: FrameworkAssessmentVendorLinkDeliveryMode;
};

export type SendFrameworkAssessmentVendorLinkResult = {
  sent: boolean;
  alreadySent: boolean;
  provider: string | null;
  recipients: string[];
  vendorUrl: string;
  assessmentId: number;
  mailboxId: number | null;
  conversationId: number | null;
  messageId: number | null;
  providerMessageId: string | null;
  simulated: boolean;
};

function normalizeEmails(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      values
        .map((value) => String(value ?? "").trim().toLowerCase())
        .filter(Boolean),
    ),
  );
}

export async function sendFrameworkAssessmentVendorLink(
  input: SendFrameworkAssessmentVendorLinkInput,
): Promise<SendFrameworkAssessmentVendorLinkResult> {
  const assessmentId = Number(input.assessmentId);

  if (!Number.isInteger(assessmentId) || assessmentId <= 0) {
    throw new Error("Invalid framework assessment id.");
  }

  const assessment = await findTruvernFrameworkAssessment({
    where: { id: assessmentId },
  });

  if (!assessment) {
    throw new Error("Framework assessment not found.");
  }

  if (!assessment.organizationId) {
    throw new Error(
      "Framework assessment is not linked to an organization.",
    );
  }

  const vendor = assessment.vendorId
    ? await findVendor({
        where: { id: assessment.vendorId },
        select: {
          name: true,
          contactEmail: true,
        },
      })
    : null;

  const explicitRecipients =
    input.recipients === undefined
      ? []
      : normalizeEmails(input.recipients);

  const recipients =
    input.recipients === undefined
      ? normalizeEmails([vendor?.contactEmail])
      : explicitRecipients;

  if (!recipients.length) {
    throw new Error("At least one recipient is required.");
  }

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
      reviewAssignment.vendorId === assessment.vendorId
    )
      ? reviewAssignment
      : null;

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000";

  let vendorToken = assessment.vendorToken;

  if (!vendorToken) {
    for (
      let attempt = 0;
      attempt < 3 && !vendorToken;
      attempt += 1
    ) {
      const candidateToken =
        generateVendorFrameworkAssessmentToken();

      try {
        const claimed =
          await prisma.truvernFrameworkAssessment.updateMany({
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

        const current =
          await prisma.truvernFrameworkAssessment.findUnique({
            where: {
              id: assessment.id,
            },
            select: {
              vendorToken: true,
            },
          });

        vendorToken =
          current?.vendorToken ?? null;
      } catch (error) {
        const code =
          typeof error === "object" &&
          error !== null &&
          "code" in error
            ? String(
                (error as { code?: unknown }).code ??
                  "",
              )
            : "";

        if (code !== "P2002") {
          throw error;
        }
      }
    }
  }

  if (!vendorToken) {
    throw new Error(
      "Unable to establish secure vendor assessment access.",
    );
  }

  const vendorUrl =
    `${appUrl}/vendor-framework-assessment/${vendorToken}`;

  const externalThreadId =
    `truvern-framework-assessment:${assessment.id}:vendor-link`;

  const deliveryMode =
    input.mode ?? "AUTO_ONCE";

  if (deliveryMode === "AUTO_ONCE") {
    const existingConversation =
      await prisma.communicationConversation.findFirst({
        where: {
          organizationId:
            assessment.organizationId,
          externalThreadId,
        },
        select: {
          id: true,
          mailboxId: true,
          communicationMessages: {
            where: {
              direction: "OUTBOUND",
              status: {
                in: [
                  "QUEUED",
                  "SENT",
                  "DELIVERED",
                ],
              },
            },
            orderBy: {
              createdAt: "desc",
            },
            take: 1,
            select: {
              id: true,
              provider: true,
              providerMessageId: true,
              status: true,
            },
          },
        },
      });

    const existingMessage =
      existingConversation
        ?.communicationMessages[0];

    if (
      existingConversation &&
      existingMessage
    ) {
      return {
        sent: false,
        alreadySent: true,
        provider:
          existingMessage.provider ?? null,
        recipients,
        vendorUrl,
        assessmentId: assessment.id,
        mailboxId:
          existingConversation.mailboxId,
        conversationId:
          existingConversation.id,
        messageId:
          existingMessage.id,
        providerMessageId:
          existingMessage.providerMessageId ??
          null,
        simulated: false,
      };
    }
  }

  const subject =
    `Vendor governance assessment request - ${assessment.title}`;

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

  const result =
    await sendCommunication({
      organizationId:
        assessment.organizationId,
      mailboxKey:
        COMMUNICATION_MAILBOX_KEYS.ASSESSMENTS,
      to: recipients.join(", "),
      subject,
      html,
      priority: "NORMAL",
      channel: "EMAIL",
      externalThreadId,
      context: {
        organizationId:
          assessment.organizationId,
        vendorId:
          assessment.vendorId,
        assessmentId:
          assessment.id,
        assessmentRunId:
          assessment.assessmentRunId,
        reviewRequestId:
          linkedReviewAssignment
            ?.reviewRequestId ?? null,
        reviewAssignmentId:
          linkedReviewAssignment?.id ?? null,
      },
    });

  return {
    sent: true,
    alreadySent: false,
    provider: result.provider,
    recipients,
    vendorUrl,
    assessmentId: assessment.id,
    mailboxId: result.mailboxId,
    conversationId:
      result.conversationId,
    messageId: result.messageId,
    providerMessageId:
      result.providerMessageId,
    simulated: result.simulated,
  };
}