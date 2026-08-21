import "server-only";

import { prisma } from "@/lib/db";

import type {
  CommunicationChannel,
  CommunicationStatus,
} from "./types";

type RecipientKind =
  | "TO"
  | "CC"
  | "BCC";

type ParsedRecipient = {
  kind: RecipientKind;
  address: string;
  displayName: string | null;
};

type CreateOutboundMessageInput = {
  organizationId: number;
  mailboxId: number;
  conversationId: number;

  subject: string;
  bodyHtml: string;
  bodyText?: string;

  fromAddress: string;
  fromName?: string;

  to: string;
  cc?: string[];
  bcc?: string[];

  replyToAddress?: string;
  channel?: CommunicationChannel;
};

function parseRecipient(
  value: string,
  kind: RecipientKind,
): ParsedRecipient | null {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  const match = trimmed.match(
    /^(.*?)\s*<([^>]+)>$/,
  );

  const displayName =
    match?.[1]?.trim() ||
    null;

  const address = (
    match?.[2] ||
    trimmed
  )
    .trim()
    .toLowerCase();

  if (!address.includes("@")) {
    throw new Error(
      `Invalid ${kind.toLowerCase()} recipient address: ${trimmed}`,
    );
  }

  return {
    kind,
    address,
    displayName,
  };
}

function recipientRows(
  input: CreateOutboundMessageInput,
): ParsedRecipient[] {
  const rows: Array<ParsedRecipient | null> = [
    parseRecipient(input.to, "TO"),

    ...(input.cc || []).map(
      (value) =>
        parseRecipient(value, "CC"),
    ),

    ...(input.bcc || []).map(
      (value) =>
        parseRecipient(value, "BCC"),
    ),
  ];

  const seen =
    new Set<string>();

  return rows
    .filter(
      (
        recipient,
      ): recipient is ParsedRecipient =>
        recipient !== null,
    )
    .filter((recipient) => {
      const key =
        `${recipient.kind}:${recipient.address}`;

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);

      return true;
    });
}

export async function createQueuedOutboundMessage(
  input: CreateOutboundMessageInput,
) {
  return prisma.communicationMessage.create({
    data: {
      organizationId: input.organizationId,
      mailboxId: input.mailboxId,
      conversationId: input.conversationId,

      direction: "OUTBOUND",
      channel: input.channel || "EMAIL",
      status: "QUEUED",

      subject: input.subject,
      bodyText: input.bodyText || null,
      bodyHtml: input.bodyHtml,

      fromAddress: input.fromAddress,
      fromName: input.fromName || null,
      replyToAddress:
        input.replyToAddress || null,

      queuedAt: new Date(),

      recipients: {
        create:
          recipientRows(input).map(
            (recipient) => ({
              organizationId:
                input.organizationId,

              kind:
                recipient.kind,

              address:
                recipient.address,

              displayName:
                recipient.displayName,
            }),
          ),
      },
    },
    select: {
      id: true,
      organizationId: true,
      mailboxId: true,
      conversationId: true,
      status: true,
    },
  });
}

type MarkMessageSentInput = {
  organizationId: number;
  messageId: number;
  provider: string;
  providerMessageId?: string | null;
  internetMessageId?: string | null;
  inReplyToMessageId?: string | null;
  externalThreadId?: string | null;
  simulated?: boolean;
};

function assertPositiveInteger(
  value: number,
  label: string,
): void {
  if (
    !Number.isInteger(value) ||
    value <= 0
  ) {
    throw new Error(
      `A valid ${label} is required.`,
    );
  }
}

function normalizedProvider(
  value: string,
): string {
  const provider =
    value
      .trim()
      .toLowerCase()
      .replace(
        /[^a-z0-9._-]/g,
        "",
      )
      .slice(0, 80);

  return provider || "unknown";
}

function normalizedProviderMessageId(
  value?: string | null,
): string | null {
  if (!value) {
    return null;
  }

  const normalized =
    value
      .trim()
      .replace(
        /[^a-zA-Z0-9._:@/-]/g,
        "",
      )
      .slice(0, 255);

  return normalized || null;
}

function normalizedInternetMessageId(
  value?: string | null,
): string | null {
  if (!value) {
    return null;
  }

  const normalized =
    value
      .replace(
        /[\r\n]/g,
        "",
      )
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

async function requireOwnedMessage(
  organizationId: number,
  messageId: number,
) {
  assertPositiveInteger(
    organizationId,
    "organizationId",
  );

  assertPositiveInteger(
    messageId,
    "messageId",
  );

  const message =
    await prisma.communicationMessage.findFirst({
      where: {
        id: messageId,
        organizationId,
      },
      select: {
        id: true,
        organizationId: true,
        conversationId: true,
        mailboxId: true,
      },
    });

  if (!message) {
    throw new Error(
      "Communication message was not found.",
    );
  }

  return message;
}

export async function markCommunicationMessageSent(
  input: MarkMessageSentInput,
): Promise<void> {
  const message =
    await requireOwnedMessage(
      input.organizationId,
      input.messageId,
    );

  const sentAt =
    new Date();

  const messageUpdate =
    await prisma.communicationMessage.updateMany({
      where: {
        id: message.id,
        organizationId:
          input.organizationId,
        conversationId:
          message.conversationId,
        mailboxId:
          message.mailboxId,
      },
      data: {
        status:
          input.simulated
            ? "DELIVERED"
            : "SENT",

        provider:
          normalizedProvider(
            input.provider,
          ),

        providerMessageId:
          normalizedProviderMessageId(
            input.providerMessageId,
          ),

        internetMessageId:
          normalizedInternetMessageId(
            input.internetMessageId,
          ),

        inReplyToMessageId:
          normalizedInternetMessageId(
            input.inReplyToMessageId,
          ),

        sentAt,

        deliveredAt:
          input.simulated
            ? sentAt
            : null,

        errorCode:
          null,

        errorMessage:
          null,

        failedAt:
          null,
      },
    });

  if (messageUpdate.count !== 1) {
    throw new Error(
      "Communication message could not be updated.",
    );
  }

  const conversationUpdate =
    await prisma.communicationConversation.updateMany({
      where: {
        id:
          message.conversationId,

        organizationId:
          input.organizationId,

        mailboxId:
          message.mailboxId,
      },
      data: {
        lastMessageAt:
          sentAt,

        status:
          "OPEN",

        closedAt:
          null,

        externalThreadId:
          normalizedInternetMessageId(
            input.externalThreadId,
          ) || undefined,
      },
    });

  if (conversationUpdate.count !== 1) {
    throw new Error(
      "Communication conversation could not be updated.",
    );
  }
}

type MarkMessageFailedInput = {
  organizationId: number;
  messageId: number;
  error: unknown;
};

function safeErrorCode(
  error: unknown,
): string | null {
  if (
    !error ||
    typeof error !== "object" ||
    !("code" in error) ||
    typeof error.code !== "string"
  ) {
    return null;
  }

  const code =
    error.code
      .trim()
      .toUpperCase()
      .replace(
        /[^A-Z0-9_-]/g,
        "",
      )
      .slice(0, 80);

  return code || null;
}

export async function markCommunicationMessageFailed(
  input: MarkMessageFailedInput,
): Promise<void> {
  const message =
    await requireOwnedMessage(
      input.organizationId,
      input.messageId,
    );

  const result =
    await prisma.communicationMessage.updateMany({
      where: {
        id:
          message.id,

        organizationId:
          input.organizationId,

        conversationId:
          message.conversationId,

        mailboxId:
          message.mailboxId,
      },
      data: {
        status:
          "FAILED",

        errorCode:
          safeErrorCode(
            input.error,
          ),

        /*
         * Never persist raw provider errors.
         *
         * Provider responses can contain:
         * - recipient addresses,
         * - message contents,
         * - request payloads,
         * - authentication metadata,
         * - infrastructure details.
         */
        errorMessage:
          "Communication delivery failed.",

        failedAt:
          new Date(),
      },
    });

  if (result.count !== 1) {
    throw new Error(
      "Communication message could not be updated.",
    );
  }
}

type UpdateMessageStatusInput = {
  organizationId: number;
  messageId: number;
  status: CommunicationStatus;
};

export async function updateCommunicationMessageStatus(
  input: UpdateMessageStatusInput,
): Promise<void> {
  const message =
    await requireOwnedMessage(
      input.organizationId,
      input.messageId,
    );

  const now =
    new Date();

  const result =
    await prisma.communicationMessage.updateMany({
      where: {
        id:
          message.id,

        organizationId:
          input.organizationId,

        conversationId:
          message.conversationId,

        mailboxId:
          message.mailboxId,
      },
      data: {
        status:
          input.status,

        deliveredAt:
          input.status === "DELIVERED"
            ? now
            : undefined,

        receivedAt:
          input.status === "RECEIVED"
            ? now
            : undefined,

        failedAt:
          input.status === "FAILED"
            ? now
            : undefined,
      },
    });

  if (result.count !== 1) {
    throw new Error(
      "Communication message could not be updated.",
    );
  }
}