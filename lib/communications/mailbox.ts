import "server-only";

import { prisma } from "@/lib/db";

import {
  COMMUNICATION_MAILBOX_ADDRESSES,
  COMMUNICATION_MAILBOX_KEYS,
} from "./constants";
import type {
  CommunicationMailboxKey,
} from "./constants";
import type {
  MailboxIdentity,
} from "./types";

type ResolveMailboxInput = {
  organizationId: number;
  mailboxId?: number;
  mailboxKey?: string;
  name?: string;
  address?: string;
};

function normalizeAddress(value: string): string {
  const trimmed = value.trim();
  const match = trimmed.match(/<([^>]+)>/);

  return (match?.[1] || trimmed)
    .trim()
    .toLowerCase();
}

function isMailboxKey(
  value: string,
): value is CommunicationMailboxKey {
  return Object.values(
    COMMUNICATION_MAILBOX_KEYS,
  ).includes(value as CommunicationMailboxKey);
}

function mailboxAddressForKey(
  mailboxKey?: string,
): string | null {
  if (!mailboxKey || !isMailboxKey(mailboxKey)) {
    return null;
  }

  return COMMUNICATION_MAILBOX_ADDRESSES[
    mailboxKey
  ];
}

function defaultMailboxAddress(): string {
  const configured =
    process.env.RESEND_FROM ||
    "Truvern Assessments <assessments@truvern.com>";

  return normalizeAddress(configured);
}

function defaultMailboxName(
  mailboxKey?: string,
): string {
  switch (mailboxKey) {
    case COMMUNICATION_MAILBOX_KEYS.REVIEWS:
      return "Truvern Reviews";

    case COMMUNICATION_MAILBOX_KEYS.SUPPORT:
      return "Truvern Support";

    case COMMUNICATION_MAILBOX_KEYS.SECURITY:
      return "Truvern Security";

    case COMMUNICATION_MAILBOX_KEYS.BILLING:
      return "Truvern Billing";

    case COMMUNICATION_MAILBOX_KEYS.ASSESSMENTS:
    default:
      return "Truvern Assessments";
  }
}

export async function resolveCommunicationMailbox(
  input: ResolveMailboxInput,
): Promise<MailboxIdentity> {
  if (
    !Number.isInteger(input.organizationId) ||
    input.organizationId <= 0
  ) {
    throw new Error(
      "A valid organizationId is required.",
    );
  }

  if (input.mailboxId) {
    const mailbox =
      await prisma.communicationMailbox.findFirst({
        where: {
          id: input.mailboxId,
          organizationId: input.organizationId,
          isActive: true,
        },
        select: {
          id: true,
          organizationId: true,
          name: true,
          address: true,
        },
      });

    if (!mailbox) {
      throw new Error(
        `Communication mailbox ${input.mailboxId} was not found.`,
      );
    }

    return mailbox;
  }

  const requestedAddress =
    input.address ||
    mailboxAddressForKey(input.mailboxKey);

  if (!requestedAddress) {
    const existingDefault =
      await prisma.communicationMailbox.findFirst({
        where: {
          organizationId: input.organizationId,
          isDefault: true,
          isActive: true,
        },
        orderBy: {
          id: "asc",
        },
        select: {
          id: true,
          organizationId: true,
          name: true,
          address: true,
        },
      });

    if (existingDefault) {
      return existingDefault;
    }
  }

  const address = normalizeAddress(
    requestedAddress ||
      defaultMailboxAddress(),
  );

  const name =
    input.name?.trim() ||
    defaultMailboxName(input.mailboxKey);

  return prisma.communicationMailbox.upsert({
    where: {
      organizationId_address: {
        organizationId: input.organizationId,
        address,
      },
    },
    update: {
      name,
      isActive: true,
    },
    create: {
      organizationId: input.organizationId,
      name,
      address,
      description:
        "Mailbox for Truvern governance communications.",
      isDefault: !requestedAddress,
      isActive: true,
    },
    select: {
      id: true,
      organizationId: true,
      name: true,
      address: true,
    },
  });
}
