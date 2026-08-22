import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import prisma from "@/lib/prisma";
import { resolveCommunicationMailbox } from "@/lib/communications";
import { requireDbOrganization } from "@/lib/org-db";
import { canUseCommunications, getCurrentOrgPlanTier } from "@/lib/billing/plan-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type MailboxRow = {
  id: number;
  organizationId: number;
  name: string;
  address: string;
  description: string | null;
  isDefault: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  conversationCount: number;
  openConversationCount: number;
  closedConversationCount: number;
  messageCount: number;
  queuedMessageCount: number;
  failedMessageCount: number;
  lastMessageAt: Date | null;
};

function json(
  status: number,
  body: Record<string, unknown>,
) {
  return NextResponse.json(body, {
    status,
    headers: {
      "cache-control": "private, no-store, max-age=0, must-revalidate",
      "pragma": "no-cache",
      "expires": "0",
      "x-robots-tag": "noindex, nofollow, noarchive, nosnippet, noimageindex",
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
    },
  });
}

async function requireApiAuth() {
  const { userId } = await auth();

  if (!userId) {
    return {
      ok: false as const,
      response: json(401, {
        ok: false,
        error: "Unauthorized",
        mailboxes: [],
      }),
    };
  }

  try {
    const org = await requireDbOrganization();

    if (!("id" in org)) {
      return {
        ok: false as const,
        response: json(403, {
          ok: false,
          error: "Organization required",
          mailboxes: [],
        }),
      };
    }

    const organizationId = Number(org.id);

    if (
      !Number.isInteger(organizationId) ||
      organizationId <= 0
    ) {
      return {
        ok: false as const,
        response: json(403, {
          ok: false,
          error: "Valid organization required",
          mailboxes: [],
        }),
      };
    }

    const planTier = await getCurrentOrgPlanTier();

    if (!(await canUseCommunications(planTier))) {
      return {
        ok: false as const,
        response: json(403, {
          ok: false,
          error:
            "Communications requires a Pro or Enterprise plan",
        }),
      };
    }

    return {
      ok: true as const,
      userId,
      organizationId,
      planTier,
    };
  } catch {
    return {
      ok: false as const,
      response: json(403, {
        ok: false,
        error: "Organization required",
        mailboxes: [],
      }),
    };
  }
}

export async function GET() {
  const gate = await requireApiAuth();

  if (!gate.ok) {
    return gate.response;
  }

  try {
    /*
     * Communications Center requires a usable mailbox before
     * an operator can compose a new outbound message.
     *
     * Resolution is idempotent:
     * - an existing active default mailbox is reused;
     * - otherwise the organization's default mailbox is created.
     *
     * The resolver owns mailbox creation semantics so the API
     * does not duplicate mailbox identity or address rules.
     */
    await resolveCommunicationMailbox({
      organizationId: gate.organizationId,
    });

    const mailboxes = await prisma.$queryRaw<MailboxRow[]>`
      select
        mailbox.id,
        mailbox."organizationId",
        mailbox.name,
        mailbox.address,
        mailbox.description,
        mailbox."isDefault",
        mailbox."isActive",
        mailbox."createdAt",
        mailbox."updatedAt",

        count(
          distinct conversation.id
        )::int as "conversationCount",

        count(
          distinct conversation.id
        ) filter (
          where upper(
            coalesce(conversation.status, 'OPEN')
          ) = 'OPEN'
        )::int as "openConversationCount",

        count(
          distinct conversation.id
        ) filter (
          where upper(
            coalesce(conversation.status, 'OPEN')
          ) = 'CLOSED'
        )::int as "closedConversationCount",

        count(
          distinct message.id
        )::int as "messageCount",

        count(
          distinct message.id
        ) filter (
          where upper(
            coalesce(message.status, '')
          ) = 'QUEUED'
        )::int as "queuedMessageCount",

        count(
          distinct message.id
        ) filter (
          where upper(
            coalesce(message.status, '')
          ) = 'FAILED'
        )::int as "failedMessageCount",

        max(
          coalesce(
            message."receivedAt",
            message."deliveredAt",
            message."sentAt",
            message."queuedAt",
            message."createdAt",
            conversation."lastMessageAt"
          )
        ) as "lastMessageAt"

      from "CommunicationMailbox" mailbox

      left join "CommunicationConversation" conversation
        on conversation."mailboxId" = mailbox.id
       and conversation."organizationId" =
           mailbox."organizationId"

      left join "CommunicationMessage" message
        on message."mailboxId" = mailbox.id
       and message."organizationId" =
           mailbox."organizationId"
       and message."conversationId" =
           conversation.id

      where mailbox."organizationId" =
            ${gate.organizationId}

      group by
        mailbox.id,
        mailbox."organizationId",
        mailbox.name,
        mailbox.address,
        mailbox.description,
        mailbox."isDefault",
        mailbox."isActive",
        mailbox."createdAt",
        mailbox."updatedAt"

      order by
        mailbox."isDefault" desc,
        mailbox."isActive" desc,
        mailbox.name asc,
        mailbox.id asc
    `;

    const normalizedMailboxes =
      mailboxes.map((mailbox) => ({
        id: Number(mailbox.id),
        organizationId:
          Number(mailbox.organizationId),
        name: mailbox.name,
        address: mailbox.address,
        description: mailbox.description,
        isDefault: Boolean(mailbox.isDefault),
        isActive: Boolean(mailbox.isActive),

        counts: {
          conversations:
            Number(mailbox.conversationCount ?? 0),
          openConversations:
            Number(mailbox.openConversationCount ?? 0),
          closedConversations:
            Number(mailbox.closedConversationCount ?? 0),
          messages:
            Number(mailbox.messageCount ?? 0),
          queuedMessages:
            Number(mailbox.queuedMessageCount ?? 0),
          failedMessages:
            Number(mailbox.failedMessageCount ?? 0),
        },

        lastMessageAt:
          mailbox.lastMessageAt
            ? mailbox.lastMessageAt.toISOString()
            : null,

        createdAt:
          mailbox.createdAt.toISOString(),

        updatedAt:
          mailbox.updatedAt.toISOString(),
      }));

    const totals =
      normalizedMailboxes.reduce(
        (result, mailbox) => ({
          mailboxes: result.mailboxes + 1,
          activeMailboxes:
            result.activeMailboxes +
            (mailbox.isActive ? 1 : 0),
          conversations:
            result.conversations +
            mailbox.counts.conversations,
          openConversations:
            result.openConversations +
            mailbox.counts.openConversations,
          closedConversations:
            result.closedConversations +
            mailbox.counts.closedConversations,
          messages:
            result.messages +
            mailbox.counts.messages,
          queuedMessages:
            result.queuedMessages +
            mailbox.counts.queuedMessages,
          failedMessages:
            result.failedMessages +
            mailbox.counts.failedMessages,
        }),
        {
          mailboxes: 0,
          activeMailboxes: 0,
          conversations: 0,
          openConversations: 0,
          closedConversations: 0,
          messages: 0,
          queuedMessages: 0,
          failedMessages: 0,
        },
      );

    return json(200, {
      ok: true,
      organizationId: gate.organizationId,
      defaultMailboxId:
        normalizedMailboxes.find(
          (mailbox) =>
            mailbox.isDefault &&
            mailbox.isActive,
        )?.id ??
        normalizedMailboxes.find(
          (mailbox) => mailbox.isActive,
        )?.id ??
        null,
      totals,
      mailboxes: normalizedMailboxes,
    });
  } catch (error) {
    console.error(
      "communications.mailboxes.get.failed",
      error,
    );

    return json(500, {
      ok: false,
      error: "Failed to load communication mailboxes",
      detail:
        error instanceof Error
          ? error.message
          : "Unknown error",
      mailboxes: [],
    });
  }
}
