import "server-only";

import {
  createCommunicationMessage,
  findFirstCommunicationConversation,
  updateCommunicationConversation,
} from "@/lib/repositories/communication-repository";

type RecordAssessmentSubmissionInput = {
  organizationId: number;
  vendorId: number;
  assessmentId: number;
  completionPercent: number;
  submittedAt?: Date | null;
};

export async function recordAssessmentSubmissionCommunication(
  input: RecordAssessmentSubmissionInput,
): Promise<{
  recorded: boolean;
  conversationId: number | null;
  messageId: number | null;
}> {
  const externalThreadId =
    `assessment:${input.assessmentId}:vendor-link`;

  const conversation =
    await findFirstCommunicationConversation({
      where: {
        organizationId:
          input.organizationId,
        assessmentId:
          input.assessmentId,
        externalThreadId,
      },
      orderBy: {
        updatedAt: "desc",
      },
      select: {
        id: true,
        mailboxId: true,
        subject: true,
      },
    });

  /*
   * Submission should enrich an existing assessment
   * communications thread, not create a disconnected
   * conversation when no vendor communication exists.
   */
  if (!conversation) {
    return {
      recorded: false,
      conversationId: null,
      messageId: null,
    };
  }

  /*
   * Protect against duplicate lifecycle events even if
   * the calling route is retried after another side effect.
   */
  const existingEvent =
    await findFirstCommunicationConversation({
      where: {
        id: conversation.id,
        organizationId:
          input.organizationId,
        communicationMessages: {
          some: {
            direction: "INTERNAL",
            channel: "SYSTEM",
            subject:
              "Vendor assessment submitted",
          },
        },
      },
      select: {
        id: true,
      },
    });

  if (existingEvent) {
    return {
      recorded: false,
      conversationId:
        conversation.id,
      messageId: null,
    };
  }

  const occurredAt =
    input.submittedAt ??
    new Date();

  const message =
    await createCommunicationMessage({
      data: {
        organizationId:
          input.organizationId,

        mailboxId:
          conversation.mailboxId,

        conversationId:
          conversation.id,

        direction: "INTERNAL",
        channel: "SYSTEM",
        status: "RECEIVED",

        subject:
          "Vendor assessment submitted",

        bodyText:
          `Vendor #${input.vendorId} completed and submitted assessment #${input.assessmentId} for governance review. Completion: ${input.completionPercent}%.`,

        bodyHtml:
          `<p>Vendor #${input.vendorId} completed and submitted assessment #${input.assessmentId} for governance review.</p><p>Completion: ${input.completionPercent}%.</p>`,

        fromAddress:
          "system@truvern.com",

        fromName:
          "Truvern Governance",

        receivedAt:
          occurredAt,
      },
      select: {
        id: true,
      },
    });

  await updateCommunicationConversation({
    where: {
      id: conversation.id,
    },
    data: {
      lastMessageAt:
        occurredAt,
      status:
        "OPEN",
      closedAt:
        null,
    },
  });

  return {
    recorded: true,
    conversationId:
      conversation.id,
    messageId:
      message.id,
  };
}
