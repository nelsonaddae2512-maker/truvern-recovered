import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";

export type CommunicationConversationSearchInput = {
  organizationId: number;
  mailboxId?: number | null;
  vendorId?: number | null;
  assessmentId?: number | null;
  assessmentRunId?: number | null;
  reviewRequestId?: number | null;
  reviewAssignmentId?: number | null;
  status?: string | null;
  priority?: string | null;
  channel?: string | null;
  search?: string | null;
  page: number;
  pageSize: number;
};

export type CommunicationConversationSearchRow = Record<string, any>;

export async function searchCommunicationConversations(
  input: CommunicationConversationSearchInput,
): Promise<{
  total: number;
  rows: CommunicationConversationSearchRow[];
}> {
  const conditions: Prisma.Sql[] = [
    Prisma.sql`conversation."organizationId" = ${input.organizationId}`,
  ];

  if (input.mailboxId) {
    conditions.push(
      Prisma.sql`conversation."mailboxId" = ${input.mailboxId}`,
    );
  }

  if (input.vendorId) {
    conditions.push(
      Prisma.sql`conversation."vendorId" = ${input.vendorId}`,
    );
  }

  if (input.assessmentId) {
    conditions.push(
      Prisma.sql`conversation."assessmentId" = ${input.assessmentId}`,
    );
  }

  if (input.assessmentRunId) {
    conditions.push(
      Prisma.sql`conversation."assessmentRunId" = ${input.assessmentRunId}`,
    );
  }

  if (input.reviewRequestId) {
    conditions.push(
      Prisma.sql`conversation."reviewRequestId" = ${input.reviewRequestId}`,
    );
  }

  if (input.reviewAssignmentId) {
    conditions.push(
      Prisma.sql`conversation."reviewAssignmentId" = ${input.reviewAssignmentId}`,
    );
  }

  if (input.status) {
    conditions.push(
      Prisma.sql`upper(conversation.status) = ${input.status}`,
    );
  }

  if (input.priority) {
    conditions.push(
      Prisma.sql`upper(conversation.priority) = ${input.priority}`,
    );
  }

  if (input.channel) {
    conditions.push(
      Prisma.sql`upper(conversation.channel) = ${input.channel}`,
    );
  }

  if (input.search) {
    const searchParameter = `%${input.search}%`;

    conditions.push(
      Prisma.sql`
        (
          conversation.subject ilike ${searchParameter}
          or coalesce(
            conversation."externalThreadId",
            ''
          ) ilike ${searchParameter}
          or mailbox.name ilike ${searchParameter}
          or mailbox.address ilike ${searchParameter}
          or exists (
            select 1
            from "CommunicationMessage" searched_message
            where searched_message."conversationId" =
                  conversation.id
              and searched_message."organizationId" =
                  conversation."organizationId"
              and (
                coalesce(
                  searched_message.subject,
                  ''
                ) ilike ${searchParameter}
                or coalesce(
                  searched_message."bodyText",
                  ''
                ) ilike ${searchParameter}
                or coalesce(
                  searched_message."fromAddress",
                  ''
                ) ilike ${searchParameter}
                or coalesce(
                  searched_message."fromName",
                  ''
                ) ilike ${searchParameter}
              )
          )
        )
      `,
    );
  }

  const whereClause =
    Prisma.join(conditions, " and ");

  const countRows =
    await prisma.$queryRaw<Array<{ total: number }>>(
      Prisma.sql`
        select
          count(*)::int as total
        from "CommunicationConversation" conversation
        join "CommunicationMailbox" mailbox
          on mailbox.id = conversation."mailboxId"
         and mailbox."organizationId" =
             conversation."organizationId"
        where ${whereClause}
      `,
    );

  const total =
    Number(countRows[0]?.total ?? 0);

  const offset =
    (input.page - 1) * input.pageSize;

  const rows =
    await prisma.$queryRaw<CommunicationConversationSearchRow[]>(
      Prisma.sql`
        select
          conversation.id,
          conversation."organizationId",
          conversation."mailboxId",

          mailbox.name as "mailboxName",
          mailbox.address as "mailboxAddress",
          mailbox."isDefault" as "mailboxIsDefault",
          mailbox."isActive" as "mailboxIsActive",

          conversation."vendorId",
          conversation."assessmentId",
          conversation."assessmentRunId",
          conversation."reviewRequestId",
          conversation."reviewAssignmentId",

          conversation.subject,
          conversation.status,
          conversation.priority,
          conversation.channel,
          conversation."externalThreadId",

          conversation."lastMessageAt",
          conversation."closedAt",
          conversation."createdAt",
          conversation."updatedAt",

          coalesce(
            message_stats."messageCount",
            0
          )::int as "messageCount",

          coalesce(
            message_stats."inboundMessageCount",
            0
          )::int as "inboundMessageCount",

          coalesce(
            message_stats."outboundMessageCount",
            0
          )::int as "outboundMessageCount",

          coalesce(
            message_stats."failedMessageCount",
            0
          )::int as "failedMessageCount",

          latest_message.id as "latestMessageId",
          latest_message.direction as "latestDirection",
          latest_message.status as "latestStatus",
          latest_message.subject as "latestSubject",
          latest_message."bodyText" as "latestBodyText",
          latest_message."bodyHtml" as "latestBodyHtml",
          latest_message."fromAddress" as "latestFromAddress",
          latest_message."fromName" as "latestFromName",
          latest_message."createdAt" as "latestCreatedAt",

          coalesce(
            latest_message."receivedAt",
            latest_message."deliveredAt",
            latest_message."sentAt",
            latest_message."queuedAt",
            latest_message."createdAt",
            conversation."lastMessageAt",
            conversation."updatedAt",
            conversation."createdAt"
          ) as "latestActivityAt"

        from "CommunicationConversation" conversation

        join "CommunicationMailbox" mailbox
          on mailbox.id = conversation."mailboxId"
         and mailbox."organizationId" =
             conversation."organizationId"

        left join lateral (
          select
            count(*)::int as "messageCount",

            count(*) filter (
              where upper(message.direction) = 'INBOUND'
            )::int as "inboundMessageCount",

            count(*) filter (
              where upper(message.direction) = 'OUTBOUND'
            )::int as "outboundMessageCount",

            count(*) filter (
              where upper(message.status) = 'FAILED'
            )::int as "failedMessageCount"

          from "CommunicationMessage" message
          where message."conversationId" =
                conversation.id
            and message."organizationId" =
                conversation."organizationId"
        ) message_stats on true

        left join lateral (
          select message.*
          from "CommunicationMessage" message
          where message."conversationId" =
                conversation.id
            and message."organizationId" =
                conversation."organizationId"
          order by
            coalesce(
              message."receivedAt",
              message."deliveredAt",
              message."sentAt",
              message."queuedAt",
              message."createdAt"
            ) desc,
            message.id desc
          limit 1
        ) latest_message on true

        where ${whereClause}

        order by
          coalesce(
            conversation."lastMessageAt",
            latest_message."receivedAt",
            latest_message."deliveredAt",
            latest_message."sentAt",
            latest_message."queuedAt",
            latest_message."createdAt",
            conversation."updatedAt",
            conversation."createdAt"
          ) desc,
          conversation.id desc

        limit ${input.pageSize}
        offset ${offset}
      `,
    );

  return {
    total,
    rows,
  };
}