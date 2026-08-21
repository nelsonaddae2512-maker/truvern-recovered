import "server-only";

import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email";

import {
  resolveCommunicationConversation,
} from "./conversation";
import {
  resolveCommunicationMailbox,
} from "./mailbox";
import {
  createQueuedOutboundMessage,
  markCommunicationMessageFailed,
  markCommunicationMessageSent,
} from "./message";
import type {
  SendCommunicationInput,
  SendCommunicationResult,
} from "./types";

type ParsedIdentity = {
  name: string;
  address: string;
  formatted: string;
};

type ReplyThreadingContext = {
  parentInternetMessageId: string | null;
  references: string[];
  externalThreadId: string | null;
};

function parseIdentity(
  value: string,
  fallbackName: string,
): ParsedIdentity {
  const trimmed = value.trim();
  const match = trimmed.match(
    /^(.*?)\s*<([^>]+)>$/,
  );

  const name = (
    match?.[1] ||
    fallbackName
  ).trim();

  const address = (
    match?.[2] ||
    trimmed
  )
    .trim()
    .toLowerCase();

  return {
    name,
    address,
    formatted: name
      ? `${name} <${address}>`
      : address,
  };
}

function providerMessageId(
  result: unknown,
): string | null {
  if (!result || typeof result !== "object") {
    return null;
  }

  const record = result as {
    out?: {
      id?: unknown;
      data?: {
        id?: unknown;
      };
    };
  };

  const id =
    record.out?.data?.id ??
    record.out?.id;

  return typeof id === "string"
    ? id.trim() || null
    : null;
}

function normalizeRfcMessageId(
  value?: string | null,
): string | null {
  if (!value) {
    return null;
  }

  const normalized =
    value
      .replace(/[\r\n]/g, "")
      .trim()
      .slice(0, 998);

  if (
    !/^<[^<>\s@]+@[^<>\s@]+>$/.test(
      normalized,
    )
  ) {
    return null;
  }

  return normalized;
}

function mailboxDomain(
  mailboxAddress: string,
): string {
  const address =
    mailboxAddress
      .trim()
      .toLowerCase();

  const atIndex =
    address.lastIndexOf("@");

  const candidate =
    atIndex >= 0
      ? address.slice(atIndex + 1)
      : "";

  const domain =
    candidate
      .replace(
        /[^a-z0-9.-]/g,
        "",
      )
      .replace(
        /^\.+|\.+$/g,
        "",
      );

  return domain || "truvern.com";
}

function outboundInternetMessageId(
  messageId: number,
  mailboxAddress: string,
): string {
  const domain =
    mailboxDomain(
      mailboxAddress,
    );

  return (
    `<truvern.communication.` +
    `${messageId}@${domain}>`
  );
}

async function resolveReplyThreading(
  input: {
    organizationId: number;
    mailboxId: number;
    conversationId: number;
    replyMessageId?: number;
  },
): Promise<ReplyThreadingContext> {
  if (!input.replyMessageId) {
    const conversation =
      await prisma.communicationConversation.findFirst({
        where: {
          id: input.conversationId,
          organizationId:
            input.organizationId,
          mailboxId:
            input.mailboxId,
        },
        select: {
          externalThreadId: true,
        },
      });

    if (!conversation) {
      throw new Error(
        "Communication conversation was not found.",
      );
    }

    return {
      parentInternetMessageId: null,
      references: [],
      externalThreadId:
        conversation.externalThreadId ||
        null,
    };
  }

  const parent =
    await prisma.communicationMessage.findFirst({
      where: {
        id:
          input.replyMessageId,

        organizationId:
          input.organizationId,

        mailboxId:
          input.mailboxId,

        conversationId:
          input.conversationId,
      },

      select: {
        id: true,
        internetMessageId: true,
        inReplyToMessageId: true,

        conversation: {
          select: {
            externalThreadId: true,
          },
        },
      },
    });

  if (!parent) {
    throw new Error(
      "The reply message was not found in this conversation.",
    );
  }

  const parentInternetMessageId =
    normalizeRfcMessageId(
      parent.internetMessageId,
    );

  const conversationThreadId =
    normalizeRfcMessageId(
      parent.conversation.externalThreadId,
    );

  const messages =
    await prisma.communicationMessage.findMany({
      where: {
        organizationId:
          input.organizationId,

        mailboxId:
          input.mailboxId,

        conversationId:
          input.conversationId,

        internetMessageId: {
          not: null,
        },
      },

      orderBy: [
        {
          createdAt: "asc",
        },
        {
          id: "asc",
        },
      ],

      select: {
        internetMessageId: true,
        inReplyToMessageId: true,
      },
    });

  const parentByMessageId =
    new Map<string, string | null>();

  for (const message of messages) {
    const internetMessageId =
      normalizeRfcMessageId(
        message.internetMessageId,
      );

    if (!internetMessageId) {
      continue;
    }

    parentByMessageId.set(
      internetMessageId,
      normalizeRfcMessageId(
        message.inReplyToMessageId,
      ),
    );
  }

  const reverseReferences: string[] = [];
  const visited =
    new Set<string>();

  let current =
    parentInternetMessageId;

  while (
    current &&
    !visited.has(current) &&
    reverseReferences.length < 50
  ) {
    visited.add(current);
    reverseReferences.push(current);

    current =
      parentByMessageId.get(current) ||
      null;
  }

  const references =
    reverseReferences.reverse();

  if (
    !references.length &&
    conversationThreadId
  ) {
    references.push(
      conversationThreadId,
    );
  }

  return {
    parentInternetMessageId,
    references,

    externalThreadId:
      parent.conversation.externalThreadId ||
      references[0] ||
      parentInternetMessageId ||
      null,
  };
}

export async function sendCommunication(
  input: SendCommunicationInput,
): Promise<SendCommunicationResult> {
  if (
    !Number.isInteger(input.organizationId) ||
    input.organizationId <= 0
  ) {
    throw new Error(
      "A valid organizationId is required.",
    );
  }

  if (!input.to.trim()) {
    throw new Error(
      "A recipient email address is required.",
    );
  }

  if (!input.subject.trim()) {
    throw new Error(
      "A communication subject is required.",
    );
  }

  if (!input.html.trim()) {
    throw new Error(
      "Communication HTML content is required.",
    );
  }

  if (
    input.replyMessageId &&
    !input.conversationId
  ) {
    throw new Error(
      "A conversationId is required when replying to a message.",
    );
  }

  const mailbox =
    await resolveCommunicationMailbox({
      organizationId:
        input.organizationId,

      mailboxId:
        input.mailboxId,

      mailboxKey:
        input.mailboxKey,

      name:
        input.mailboxName,

      address:
        input.mailboxAddress,
    });

  const conversation =
    await resolveCommunicationConversation({
      organizationId:
        input.organizationId,

      mailboxId:
        mailbox.id,

      conversationId:
        input.conversationId,

      externalThreadId:
        input.externalThreadId,

      subject:
        input.subject,

      priority:
        input.priority,

      channel:
        input.channel,

      context:
        input.context,
    });

  const threading =
    await resolveReplyThreading({
      organizationId:
        input.organizationId,

      mailboxId:
        mailbox.id,

      conversationId:
        conversation.id,

      replyMessageId:
        input.replyMessageId,
    });

  const identity =
    parseIdentity(
      input.from ||
        mailbox.address,

      mailbox.name,
    );

  const message =
    await createQueuedOutboundMessage({
      organizationId:
        input.organizationId,

      mailboxId:
        mailbox.id,

      conversationId:
        conversation.id,

      subject:
        input.subject.trim(),

      bodyHtml:
        input.html,

      bodyText:
        input.text,

      fromAddress:
        identity.address,

      fromName:
        identity.name,

      to:
        input.to.trim(),

      cc:
        input.cc,

      bcc:
        input.bcc,

      replyToAddress:
        input.replyTo?.trim() ||
        undefined,

      channel:
        input.channel,
    });

  const internetMessageId =
    outboundInternetMessageId(
      message.id,
      mailbox.address,
    );

  const headers:
    Record<string, string> = {
      "Message-ID":
        internetMessageId,
    };

  if (
    threading.parentInternetMessageId
  ) {
    headers["In-Reply-To"] =
      threading.parentInternetMessageId;
  }

  if (threading.references.length) {
    headers.References =
      threading.references.join(" ");
  }

  const externalThreadId =
    threading.externalThreadId ||
    input.externalThreadId?.trim() ||
    threading.references[0] ||
    threading.parentInternetMessageId ||
    internetMessageId;

  try {
    const result =
      await sendEmail({
        to:
          input.to.trim(),

        cc:
          input.cc,

        bcc:
          input.bcc,

        replyTo:
          input.replyTo,

        subject:
          input.subject.trim(),

        html:
          input.html,

        from:
          identity.formatted,

        headers,
      });

    const provider =
      "provider" in result
        ? String(result.provider)
        : "unknown";

    const simulated =
      "simulated" in result &&
      result.simulated === true;

    const resolvedProviderMessageId =
      providerMessageId(result);

    await markCommunicationMessageSent({
      organizationId:
        input.organizationId,

      messageId:
        message.id,

      provider,

      providerMessageId:
        resolvedProviderMessageId,

      internetMessageId,

      inReplyToMessageId:
        threading.parentInternetMessageId,

      externalThreadId,

      simulated,
    });

    return {
      ok: true,

      mailboxId:
        mailbox.id,

      conversationId:
        conversation.id,

      messageId:
        message.id,

      provider,

      providerMessageId:
        resolvedProviderMessageId,

      simulated,
    };
  }
  catch (error) {
    await markCommunicationMessageFailed({
      organizationId:
        input.organizationId,

      messageId:
        message.id,

      error,
    });

    throw error;
  }
}