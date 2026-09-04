import {
  COMMUNICATION_MAILBOX_KEYS,
  sendCommunication,
} from "@/lib/communications";
import { prisma } from "@/lib/prisma";

export type AssessmentVendorLinkDeliveryResult = {
  sent: boolean;
  alreadySent: boolean;
  mailboxId: number | null;
  conversationId: number | null;
  messageId: number | null;
  providerMessageId: string | null;
  simulated: boolean | null;
};

function normalizeRecipients(
  values: Array<string | null | undefined>,
): string[] {
  return Array.from(
    new Set(
      values
        .map((value) =>
          String(value ?? "")
            .trim()
            .toLowerCase(),
        )
        .filter(Boolean),
    ),
  );
}

export async function sendAssessmentVendorLink(input: {
  assessmentId: number;
  recipients?: string[];
  mode?: "AUTO_ONCE" | "MANUAL_RESEND";
}): Promise<AssessmentVendorLinkDeliveryResult> {
  if (
    !Number.isInteger(input.assessmentId) ||
    input.assessmentId <= 0
  ) {
    throw new Error("A valid assessmentId is required.");
  }

  const assessment =
    await prisma.assessment.findUnique({
      where: {
        id: input.assessmentId,
      },
      select: {
        id: true,
        title: true,
        token: true,
        dueAt: true,
        organizationId: true,
        vendorId: true,
        vendorEmail: true,
        reviewAssignmentId: true,
        vendor: {
          select: {
            name: true,
            contactEmail: true,
          },
        },
      },
    });

  if (!assessment) {
    throw new Error("Assessment not found.");
  }

  if (!assessment.token) {
    throw new Error(
      "Assessment does not have a vendor portal token.",
    );
  }

  const recipients =
    normalizeRecipients(
      input.recipients?.length
        ? input.recipients
        : [
            assessment.vendorEmail,
            assessment.vendor?.contactEmail,
          ],
    );

  if (!recipients.length) {
    throw new Error(
      "The vendor does not have an email address for assessment delivery.",
    );
  }

  const externalThreadId =
    `assessment:${assessment.id}:vendor-link`;

  const deliveryMode =
    input.mode ?? "AUTO_ONCE";

  if (deliveryMode === "AUTO_ONCE") {
    const existingConversation =
      await prisma.communicationConversation.findFirst({
        where: {
          organizationId:
            assessment.organizationId,
          assessmentId:
            assessment.id,
          externalThreadId,
        },
        orderBy: {
          id: "asc",
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
              id: "asc",
            },
            take: 1,
            select: {
              id: true,
              providerMessageId: true,
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
        mailboxId:
          existingConversation.mailboxId,
        conversationId:
          existingConversation.id,
        messageId:
          existingMessage.id,
        providerMessageId:
          existingMessage.providerMessageId,
        simulated: null,
      };
    }
  }

  const reviewAssignment =
    assessment.reviewAssignmentId
      ? await prisma.reviewAssignment.findFirst({
          where: {
            id:
              assessment.reviewAssignmentId,
            organizationId:
              assessment.organizationId,
            vendorId:
              assessment.vendorId,
          },
          select: {
            id: true,
            reviewRequestId: true,
          },
        })
      : null;

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000";

  const vendorUrl =
    `${appUrl}/vendor-assessment/${assessment.token}`;

  const dueDate =
    assessment.dueAt
      ? new Intl.DateTimeFormat(
          "en-US",
          {
            month: "short",
            day: "numeric",
            year: "numeric",
          },
        ).format(assessment.dueAt)
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

  const result =
    await sendCommunication({
      organizationId:
        assessment.organizationId,

      mailboxKey:
        COMMUNICATION_MAILBOX_KEYS.ASSESSMENTS,

      to:
        recipients.join(", "),

      subject,
      html,

      priority:
        "NORMAL",

      channel:
        "EMAIL",

      externalThreadId,

      context: {
        organizationId:
          assessment.organizationId,

        vendorId:
          assessment.vendorId,

        assessmentId:
          assessment.id,

        reviewRequestId:
          reviewAssignment?.reviewRequestId ??
          null,

        reviewAssignmentId:
          reviewAssignment?.id ??
          null,
      },
    });

  return {
    sent: true,
    alreadySent: false,
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
  };
}