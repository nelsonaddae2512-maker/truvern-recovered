import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import prisma from "@/lib/prisma";
import { requireDbOrganization } from "@/lib/org-db";
import { canUseCommunications, getCurrentOrgPlanTier } from "@/lib/billing/plan-access";
import {
  deleteCommunicationConversation,
  findCommunicationMessages,
  findFirstCommunicationConversation,
} from "@/lib/repositories/communication-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type ConversationRow = {
  id: number;
  organizationId: number;
  mailboxId: number;

  mailboxName: string;
  mailboxAddress: string;
  mailboxDescription: string | null;
  mailboxIsDefault: boolean;
  mailboxIsActive: boolean;

  vendorId: number | null;
  vendorName: string | null;

  assessmentId: number | null;
  assessmentName: string | null;
  assessmentStatus: string | null;

  assessmentRunId: number | null;
  assessmentRunStatus: string | null;

  reviewRequestId: number | null;
  reviewRequestStatus: string | null;

  reviewAssignmentId: number | null;
  reviewAssignmentStatus: string | null;
  reviewAssignmentType: string | null;
  assignedReviewerName: string | null;

  subject: string;
  status: string;
  priority: string;
  channel: string;
  externalThreadId: string | null;

  lastMessageAt: Date | null;
  closedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
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

function positiveInt(value: unknown) {
  const number = Number(value);

  if (
    !Number.isInteger(number) ||
    number <= 0
  ) {
    return null;
  }

  return number;
}

function iso(value: Date | null | undefined) {
  return value
    ? value.toISOString()
    : null;
}

async function requireApiAuth() {
  const { userId } = await auth();

  if (!userId) {
    return {
      ok: false as const,
      response: json(401, {
        ok: false,
        error: "Unauthorized",
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
        }),
      };
    }

    const organizationId =
      positiveInt(org.id);

    if (!organizationId) {
      return {
        ok: false as const,
        response: json(403, {
          ok: false,
          error: "Valid organization required",
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
            "Communications requires Pro, Enterprise, or Truvern Ops access",
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
      }),
    };
  }
}

export async function GET(
  _request: Request,
  context: RouteContext,
) {
  const gate = await requireApiAuth();

  if (!gate.ok) {
    return gate.response;
  }

  const params = await context.params;
  const conversationId =
    positiveInt(params.id);

  if (!conversationId) {
    return json(400, {
      ok: false,
      error: "Invalid conversation id",
    });
  }

  try {
    const conversationRows =
      await prisma.$queryRaw<ConversationRow[]>`
        select
          conversation.id,
          conversation."organizationId",
          conversation."mailboxId",

          mailbox.name as "mailboxName",
          mailbox.address as "mailboxAddress",
          mailbox.description as "mailboxDescription",
          mailbox."isDefault" as "mailboxIsDefault",
          mailbox."isActive" as "mailboxIsActive",

          conversation."vendorId",
          coalesce(
            to_jsonb(vendor) ->> 'name',
            to_jsonb(vendor) ->> 'legalName',
            to_jsonb(vendor) ->> 'companyName'
          ) as "vendorName",

          conversation."assessmentId",
          coalesce(
            to_jsonb(assessment) ->> 'name',
            to_jsonb(assessment) ->> 'title'
          ) as "assessmentName",
          to_jsonb(assessment) ->> 'status'
            as "assessmentStatus",

          conversation."assessmentRunId",
          to_jsonb(assessment_run) ->> 'status'
            as "assessmentRunStatus",

          conversation."reviewRequestId",
          to_jsonb(review_request) ->> 'status'
            as "reviewRequestStatus",

          conversation."reviewAssignmentId",
          to_jsonb(review_assignment) ->> 'status'
            as "reviewAssignmentStatus",

          to_jsonb(review_assignment) ->> 'assignmentType'
            as "reviewAssignmentType",

          coalesce(
            to_jsonb(review_assignment) ->> 'assignedReviewerName',
            to_jsonb(review_assignment) ->> 'reviewerName',
            to_jsonb(review_assignment) ->> 'assignedTo'
          ) as "assignedReviewerName",

          conversation.subject,
          conversation.status,
          conversation.priority,
          conversation.channel,
          conversation."externalThreadId",

          conversation."lastMessageAt",
          conversation."closedAt",
          conversation."createdAt",
          conversation."updatedAt"

        from "CommunicationConversation" conversation

        join "CommunicationMailbox" mailbox
          on mailbox.id = conversation."mailboxId"
         and mailbox."organizationId" =
             conversation."organizationId"

        left join "Vendor" vendor
          on vendor.id = conversation."vendorId"

        left join "Assessment" assessment
          on assessment.id = conversation."assessmentId"

        left join "AssessmentRun" assessment_run
          on assessment_run.id =
             conversation."assessmentRunId"

        left join "ReviewRequest" review_request
          on review_request.id =
             conversation."reviewRequestId"

        left join "ReviewAssignment" review_assignment
          on review_assignment.id =
             conversation."reviewAssignmentId"

        where conversation.id =
              ${conversationId}

          and conversation."organizationId" =
              ${gate.organizationId}

        limit 1
      `;

    const row = conversationRows[0];

    if (!row) {
      return json(404, {
        ok: false,
        error: "Conversation not found",
      });
    }

    const messages =
      await findCommunicationMessages({
        where: {
          conversationId,
          organizationId:
            gate.organizationId,
          mailboxId:
            Number(row.mailboxId),
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
          id: true,
          organizationId: true,
          mailboxId: true,
          conversationId: true,

          direction: true,
          channel: true,
          status: true,

          subject: true,
          bodyText: true,
          bodyHtml: true,

          fromAddress: true,
          fromName: true,
          replyToAddress: true,

          provider: true,
          providerMessageId: true,
          internetMessageId: true,
          inReplyToMessageId: true,

          errorCode: true,
          errorMessage: true,

          queuedAt: true,
          sentAt: true,
          deliveredAt: true,
          receivedAt: true,
          failedAt: true,

          createdAt: true,
          updatedAt: true,

          /*
           * BCC is intentionally excluded from the browser response.
           *
           * Organization ownership alone is not a sufficiently narrow
           * authorization rule for blind-recipient disclosure.
           */
          recipients: {
            where: {
              organizationId:
                gate.organizationId,

              kind: {
                in: [
                  "TO",
                  "CC",
                ],
              },
            },

            orderBy: [
              {
                kind:
                  "asc",
              },
              {
                address:
                  "asc",
              },
            ],

            select: {
              kind:
                true,

              address:
                true,

              displayName:
                true,
            },
          },
        },
      });

    const timeline =
      messages.map((message) => ({
        id: message.id,

        direction:
          message.direction,

        channel:
          message.channel,

        status:
          message.status,

        subject:
          message.subject,

        body: {
          text:
            message.bodyText,
          html:
            message.bodyHtml,
        },

        from: {
          address:
            message.fromAddress,
          name:
            message.fromName,
        },

        replyToAddress:
          message.replyToAddress,

        recipients:
          message.recipients.map(
            (recipient) => ({
              kind:
                recipient.kind,

              address:
                recipient.address,

              displayName:
                recipient.displayName,
            }),
          ),

        threading: {
          externalThreadId:
            row.externalThreadId,

          provider:
            message.provider,

          providerMessageId:
            message.providerMessageId,

          internetMessageId:
            message.internetMessageId,

          inReplyToMessageId:
            message.inReplyToMessageId,
        },

        delivery: {
          queuedAt:
            iso(message.queuedAt),

          sentAt:
            iso(message.sentAt),

          deliveredAt:
            iso(message.deliveredAt),

          receivedAt:
            iso(message.receivedAt),

          failedAt:
            iso(message.failedAt),

          error:
            message.errorCode ||
            message.errorMessage
              ? {
                  code:
                    message.errorCode,

                  message:
                    message.errorMessage,
                }
              : null,
        },

        activityAt:
          iso(
            message.receivedAt ??
            message.deliveredAt ??
            message.sentAt ??
            message.queuedAt ??
            message.failedAt ??
            message.createdAt,
          ),

        createdAt:
          message.createdAt.toISOString(),

        updatedAt:
          message.updatedAt.toISOString(),
      }));

    const counts =
      timeline.reduce(
        (result, message) => ({
          total:
            result.total + 1,

          inbound:
            result.inbound +
            (
              message.direction
                .toUpperCase() === "INBOUND"
                ? 1
                : 0
            ),

          outbound:
            result.outbound +
            (
              message.direction
                .toUpperCase() === "OUTBOUND"
                ? 1
                : 0
            ),

          internal:
            result.internal +
            (
              message.direction
                .toUpperCase() === "INTERNAL"
                ? 1
                : 0
            ),

          failed:
            result.failed +
            (
              message.status
                .toUpperCase() === "FAILED"
                ? 1
                : 0
            ),
        }),
        {
          total: 0,
          inbound: 0,
          outbound: 0,
          internal: 0,
          failed: 0,
        },
      );

    return json(200, {
      ok: true,

      organizationId:
        gate.organizationId,

      conversation: {
        id:
          Number(row.id),

        subject:
          row.subject,

        status:
          row.status,

        priority:
          row.priority,

        channel:
          row.channel,

        externalThreadId:
          row.externalThreadId,

        mailbox: {
          id:
            Number(row.mailboxId),

          name:
            row.mailboxName,

          address:
            row.mailboxAddress,

          description:
            row.mailboxDescription,

          isDefault:
            Boolean(row.mailboxIsDefault),

          isActive:
            Boolean(row.mailboxIsActive),
        },

        linkedRecords: {
          vendor:
            row.vendorId == null
              ? null
              : {
                  id:
                    Number(row.vendorId),

                  name:
                    row.vendorName,
                },

          assessment:
            row.assessmentId == null
              ? null
              : {
                  id:
                    Number(row.assessmentId),

                  name:
                    row.assessmentName,

                  status:
                    row.assessmentStatus,
                },

          assessmentRun:
            row.assessmentRunId == null
              ? null
              : {
                  id:
                    Number(row.assessmentRunId),

                  status:
                    row.assessmentRunStatus,
                },

          reviewRequest:
            row.reviewRequestId == null
              ? null
              : {
                  id:
                    Number(row.reviewRequestId),

                  status:
                    row.reviewRequestStatus,
                },

          reviewAssignment:
            row.reviewAssignmentId == null
              ? null
              : {
                  id:
                    Number(row.reviewAssignmentId),

                  status:
                    row.reviewAssignmentStatus,

                  assignmentType:
                    row.reviewAssignmentType,

                  reviewer:
                    row.assignedReviewerName,
                },
        },

        counts,

        lastMessageAt:
          iso(row.lastMessageAt),

        closedAt:
          iso(row.closedAt),

        createdAt:
          row.createdAt.toISOString(),

        updatedAt:
          row.updatedAt.toISOString(),
      },

      messages: timeline,
    });
  } catch {
    /*
     * Do not log raw exception objects here.
     *
     * Database and provider exceptions can contain customer addresses,
     * message metadata, SQL fragments, or infrastructure details.
     */
    console.error(
      "communications.conversation.get.failed",
      {
        conversationId,
        organizationId:
          gate.organizationId,
      },
    );

    return json(500, {
      ok: false,
      error:
        "Failed to load communication conversation",
    });
  }
}
export async function DELETE(
  _request: Request,
  context: RouteContext,
) {
  const gate = await requireApiAuth();

  if (!gate.ok) {
    return gate.response;
  }

  const params = await context.params;
  const conversationId =
    positiveInt(params.id);

  if (!conversationId) {
    return json(400, {
      ok: false,
      error: "Invalid conversation id",
    });
  }

  try {
    /*
     * Verify ownership before deletion.
     *
     * The delete itself uses the primary key, so this organization-scoped
     * lookup is the authorization boundary preventing cross-organization
     * deletion.
     */
    const conversation =
      await findFirstCommunicationConversation({
        where: {
          id: conversationId,
          organizationId:
            gate.organizationId,
        },
        select: {
          id: true,
          organizationId: true,
          subject: true,
        },
      });

    if (!conversation) {
      return json(404, {
        ok: false,
        error: "Conversation not found",
      });
    }

    await deleteCommunicationConversation({
      where: {
        id: conversation.id,
      },
      select: {
        id: true,
      },
    });

    return json(200, {
      ok: true,
      deletedConversationId:
        conversation.id,
    });
  } catch {
    /*
     * Avoid returning database/provider details to the browser.
     */
    console.error(
      "communications.conversation.delete.failed",
      {
        conversationId,
        organizationId:
          gate.organizationId,
      },
    );

    return json(500, {
      ok: false,
      error:
        "Failed to delete communication conversation",
    });
  }
}
