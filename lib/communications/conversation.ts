import "server-only";

import { prisma } from "@/lib/db";

import type {
  CommunicationChannel,
  CommunicationEntityLinks,
  CommunicationPriority,
  ConversationReference,
} from "./types";

type ResolveConversationInput = {
  organizationId: number;
  mailboxId: number;
  subject: string;

  conversationId?: number;
  externalThreadId?: string;

  priority?: CommunicationPriority;
  channel?: CommunicationChannel;

  context?: CommunicationEntityLinks;
};

export async function resolveCommunicationConversation(
  input: ResolveConversationInput,
): Promise<ConversationReference> {
  if (!input.subject.trim()) {
    throw new Error(
      "A conversation subject is required.",
    );
  }

  if (input.conversationId) {
    const conversation =
      await prisma.communicationConversation.findFirst({
        where: {
          id: input.conversationId,
          organizationId: input.organizationId,
          mailboxId: input.mailboxId,
        },
        select: {
          id: true,
          organizationId: true,
          mailboxId: true,
          subject: true,
        },
      });

    if (!conversation) {
      throw new Error(
        `Communication conversation ${input.conversationId} was not found.`,
      );
    }

    return conversation;
  }

  const externalThreadId =
    input.externalThreadId?.trim();

  if (externalThreadId) {
    const existing =
      await prisma.communicationConversation.findFirst({
        where: {
          organizationId: input.organizationId,
          mailboxId: input.mailboxId,
          externalThreadId,
        },
        orderBy: {
          updatedAt: "desc",
        },
        select: {
          id: true,
          organizationId: true,
          mailboxId: true,
          subject: true,
        },
      });

    if (existing) {
      return existing;
    }
  }

  const context = input.context || {};

  return prisma.communicationConversation.create({
    data: {
      organizationId: input.organizationId,
      mailboxId: input.mailboxId,

      vendorId: context.vendorId ?? null,
      assessmentId: context.assessmentId ?? null,
      assessmentRunId:
        context.assessmentRunId ?? null,
      reviewRequestId:
        context.reviewRequestId ?? null,
      reviewAssignmentId:
        context.reviewAssignmentId ?? null,

      subject: input.subject.trim(),
      status: "OPEN",
      priority: input.priority || "NORMAL",
      channel: input.channel || "EMAIL",
      externalThreadId:
        externalThreadId || null,
    },
    select: {
      id: true,
      organizationId: true,
      mailboxId: true,
      subject: true,
    },
  });
}

export async function touchCommunicationConversation(
  conversationId: number,
  lastMessageAt = new Date(),
): Promise<void> {
  await prisma.communicationConversation.update({
    where: {
      id: conversationId,
    },
    data: {
      lastMessageAt,
      status: "OPEN",
      closedAt: null,
    },
  });
}

export async function closeCommunicationConversation(
  conversationId: number,
): Promise<void> {
  await prisma.communicationConversation.update({
    where: {
      id: conversationId,
    },
    data: {
      status: "CLOSED",
      closedAt: new Date(),
    },
  });
}
