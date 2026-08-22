import "server-only";

import { Resend } from "resend";

import { prisma } from "@/lib/db";
import { createOrgNotification } from "@/lib/notifications/create-notification";
import { findCommunicationMailbox } from "@/lib/repositories/communication-repository";
import { findFirstCommunicationMessage } from "@/lib/repositories/communication-repository";
import { createCommunicationMessage } from "@/lib/repositories/communication-repository";
import { findFirstCommunicationConversation } from "@/lib/repositories/communication-repository";
import { createCommunicationConversation } from "@/lib/repositories/communication-repository";
import { updateCommunicationConversation } from "@/lib/repositories/communication-repository";

type ResendWebhookData = {
  email_id?: unknown;
  created_at?: unknown;
  from?: unknown;
  to?: unknown;
  cc?: unknown;
  bcc?: unknown;
  subject?: unknown;
  message_id?: unknown;
};

type ReceivedEmail = {
  id?: unknown;
  from?: unknown;
  to?: unknown;
  cc?: unknown;
  bcc?: unknown;
  reply_to?: unknown;
  subject?: unknown;
  text?: unknown;
  html?: unknown;
  created_at?: unknown;
  message_id?: unknown;
  headers?: unknown;
};

type Address = {
  address: string;
  displayName: string | null;
};

type RecipientInput = {
  kind: "TO" | "CC" | "BCC";
  address: string;
  displayName: string | null;
};

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(asString).filter(Boolean);
  }

  const single = asString(value);
  return single ? [single] : [];
}

function parseAddress(value: string): Address | null {
  const input = value.trim();

  if (!input) {
    return null;
  }

  const match = input.match(/^(.*?)\s*<([^>]+)>$/);
  const address = (match?.[2] ?? input).trim().toLowerCase();

  if (!address.includes("@")) {
    return null;
  }

  const displayName =
    match?.[1]?.trim().replace(/^["']|["']$/g, "") || null;

  return { address, displayName };
}

function parseHeaders(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value)
      .map(([key, headerValue]) => [
        key.trim().toLowerCase(),
        asString(headerValue),
      ])
      .filter(([key, headerValue]) => Boolean(key && headerValue)),
  );
}

function normalizeMessageId(value: unknown): string | null {
  const result = asString(value).replace(/[\r\n]/g, "").slice(0, 998);

  return /^<[^<>\s@]+@[^<>\s@]+>$/.test(result) ? result : null;
}

function extractMessageIds(value: unknown): string[] {
  const matches =
    asString(value).match(/<[^<>\s@]+@[^<>\s@]+>/g) ?? [];

  return Array.from(new Set(matches)).slice(-50);
}

function normalizeSubject(value: unknown): string {
  return (
    asString(value)
      .replace(/[\r\n]+/g, " ")
      .slice(0, 500) || "(No subject)"
  );
}

function baseSubject(value: string): string {
  return (
    value.replace(/^(\s*(re|fw|fwd)\s*:\s*)+/gi, "").trim() || value
  );
}

function safeDate(value: unknown): Date {
  const parsed = new Date(asString(value));
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function recipientInputs(
  to: string[],
  cc: string[],
  bcc: string[],
): RecipientInput[] {
  const output: RecipientInput[] = [];
  const seen = new Set<string>();

  const append = (kind: RecipientInput["kind"], values: string[]) => {
    for (const value of values) {
      const parsed = parseAddress(value);

      if (!parsed) {
        continue;
      }

      const key = `${kind}:${parsed.address}`;

      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      output.push({ kind, ...parsed });
    }
  };

  append("TO", to);
  append("CC", cc);
  append("BCC", bcc);

  return output;
}

async function getReceivedEmail(emailId: string): Promise<ReceivedEmail> {
  const apiKey = asString(process.env.RESEND_API_KEY);

  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not configured.");
  }

  const resend = new Resend(apiKey);
  const response = await resend.emails.receiving.get(emailId);

  if (response.error) {
    throw new Error(
      `Unable to retrieve received email ${emailId}: ${response.error.message}`,
    );
  }

  if (!response.data) {
    throw new Error(`Received email ${emailId} returned no data.`);
  }

  return response.data as ReceivedEmail;
}

async function resolveMailbox(addresses: string[]) {
  const normalized = Array.from(
    new Set(
      addresses
        .map((value) => parseAddress(value)?.address ?? "")
        .filter(Boolean),
    ),
  );

  if (!normalized.length) {
    throw new Error("Inbound email has no valid Truvern recipient.");
  }

  const mailbox = await findCommunicationMailbox({
    where: {
      isActive: true,
      address: {
        in: normalized,
        mode: "insensitive",
      },
    },
    orderBy: [{ isDefault: "desc" }, { id: "asc" }],
    select: {
      id: true,
      organizationId: true,
      name: true,
      address: true,
    },
  });

  if (!mailbox) {
    throw new Error(
      `No active CommunicationMailbox matched: ${normalized.join(", ")}`,
    );
  }

  return mailbox;
}

async function resolveConversation(input: {
  organizationId: number;
  mailboxId: number;
  subject: string;
  senderAddress: string;
  inReplyToMessageId: string | null;
  references: string[];
}) {
  const threadIds = Array.from(
    new Set(
      [input.inReplyToMessageId, ...input.references]
        .filter((value): value is string => Boolean(value))
        .reverse(),
    ),
  );

  if (threadIds.length) {
    const message = await findFirstCommunicationMessage({
      where: {
        organizationId: input.organizationId,
        mailboxId: input.mailboxId,
        internetMessageId: { in: threadIds },
      },
      orderBy: { id: "desc" },
      select: {
        conversation: {
          select: {
            id: true,
            externalThreadId: true,
          },
        },
      },
    });

    if (message) {
      return message.conversation;
    }

    const conversation =
      await findFirstCommunicationConversation({
        where: {
          organizationId: input.organizationId,
          mailboxId: input.mailboxId,
          externalThreadId: { in: threadIds },
        },
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          externalThreadId: true,
        },
      });

    if (conversation) {
      return conversation;
    }
  }

  const subject = baseSubject(input.subject);

  const fallback = await findFirstCommunicationConversation({
    where: {
      organizationId: input.organizationId,
      mailboxId: input.mailboxId,
      subject: {
        equals: subject,
        mode: "insensitive",
      },
      communicationMessages: {
        some: {
          OR: [
            {
              fromAddress: {
                equals: input.senderAddress,
                mode: "insensitive",
              },
            },
            {
              recipients: {
                some: {
                  kind: {
                    in: ["TO", "CC"],
                  },
                  address: {
                    equals: input.senderAddress,
                    mode: "insensitive",
                  },
                },
              },
            },
          ],
        },
      },
    },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      externalThreadId: true,
    },
  });

  if (fallback) {
    return fallback;
  }

  return createCommunicationConversation({
    data: {
      organizationId: input.organizationId,
      mailboxId: input.mailboxId,
      subject,
      status: "OPEN",
      priority: "NORMAL",
      channel: "EMAIL",
      externalThreadId: threadIds.at(-1) ?? null,
      lastMessageAt: new Date(),
    },
    select: {
      id: true,
      externalThreadId: true,
    },
  });
}

export async function ingestResendInboundEmail(
  webhookData: ResendWebhookData,
) {
  const emailId = asString(webhookData.email_id);

  if (!emailId) {
    throw new Error("email.received webhook did not include email_id.");
  }

  const existing = await findFirstCommunicationMessage({
    where: {
      provider: "resend",
      providerMessageId: emailId,
    },
    select: {
      id: true,
      mailboxId: true,
      conversationId: true,
    },
  });

  if (existing) {
    return {
      ok: true as const,
      duplicate: true as const,
      messageId: existing.id,
      mailboxId: existing.mailboxId,
      conversationId: existing.conversationId,
    };
  }

  const received = await getReceivedEmail(emailId);
  const headers = parseHeaders(received.headers);

  const sender = parseAddress(
    headers.from ||
      asString(received.from) ||
      asString(webhookData.from),
  );

  if (!sender) {
    throw new Error("Inbound email sender is invalid.");
  }

  const to = asStringArray(received.to).length
    ? asStringArray(received.to)
    : asStringArray(webhookData.to);

  const cc = asStringArray(received.cc).length
    ? asStringArray(received.cc)
    : asStringArray(webhookData.cc);

  const bcc = asStringArray(received.bcc).length
    ? asStringArray(received.bcc)
    : asStringArray(webhookData.bcc);

  const mailbox = await resolveMailbox([...to, ...cc, ...bcc]);
  const subject = normalizeSubject(
    received.subject ?? webhookData.subject,
  );

  const internetMessageId = normalizeMessageId(
    received.message_id ??
      webhookData.message_id ??
      headers["message-id"],
  );

  const inReplyToMessageId = normalizeMessageId(
    headers["in-reply-to"],
  );

  const references = extractMessageIds(headers.references);

  const conversation = await resolveConversation({
    organizationId: mailbox.organizationId,
    mailboxId: mailbox.id,
    subject,
    senderAddress: sender.address,
    inReplyToMessageId,
    references,
  });

  const receivedAt = safeDate(
    received.created_at ?? webhookData.created_at,
  );

  const replyToAddress =
    asStringArray(received.reply_to)[0] ||
    headers["reply-to"] ||
    null;

  const recipients = recipientInputs(to, cc, bcc);

  const created = await prisma.$transaction(async (tx) => {
    const duplicate = await findFirstCommunicationMessage({
      where: {
        provider: "resend",
        providerMessageId: emailId,
      },
      select: {
        id: true,
        mailboxId: true,
        conversationId: true,
      },
    }, tx);

    if (duplicate) {
      return { ...duplicate, duplicate: true as const };
    }

    const message = await createCommunicationMessage({
      data: {
        organizationId: mailbox.organizationId,
        mailboxId: mailbox.id,
        conversationId: conversation.id,
        direction: "INBOUND",
        channel: "EMAIL",
        status: "RECEIVED",
        subject,
        bodyText: asString(received.text) || null,
        bodyHtml: asString(received.html) || null,
        fromAddress: sender.address,
        fromName: sender.displayName,
        replyToAddress,
        provider: "resend",
        providerMessageId: emailId,
        internetMessageId,
        inReplyToMessageId,
        receivedAt,
        recipients: recipients.length
          ? {
              create: recipients.map((recipient) => ({
                organizationId: mailbox.organizationId,
                kind: recipient.kind,
                address: recipient.address,
                displayName: recipient.displayName,
              })),
            }
          : undefined,
      },
      select: {
        id: true,
        mailboxId: true,
        conversationId: true,
      },
    }, tx);

    await updateCommunicationConversation({
      where: { id: conversation.id },
      data: {
        status: "OPEN",
        closedAt: null,
        lastMessageAt: receivedAt,
        externalThreadId:
          conversation.externalThreadId ??
          references.at(-1) ??
          inReplyToMessageId ??
          internetMessageId ??
          undefined,
      },
    }, tx);

    return { ...message, duplicate: false as const };
  });

  if (!created.duplicate) {
    try {
      await createOrgNotification({
        organizationId: mailbox.organizationId,
        type: "REVIEW_ASSIGNED",
        severity: "INFO",
        title: `New email from ${sender.displayName || sender.address}`,
        message: subject,
        href: `/communications?conversationId=${conversation.id}`,
        metadataJson: {
          source: "resend-inbound",
          mailboxId: mailbox.id,
          conversationId: conversation.id,
          communicationMessageId: created.id,
          fromAddress: sender.address,
          subject,
        },
      });
    } catch (error) {
      console.error(
        "communications.inbound.notification.failed",
        error,
      );
    }
  }

  return {
    ok: true as const,
    duplicate: created.duplicate,
    organizationId: mailbox.organizationId,
    mailboxId: mailbox.id,
    conversationId: conversation.id,
    messageId: created.id,
    providerMessageId: emailId,
  };
}
