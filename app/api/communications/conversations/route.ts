import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { requireDbOrganization } from "@/lib/org-db";
import { canUseCommunications, getCurrentOrgPlanTier } from "@/lib/billing/plan-access";
import { searchCommunicationConversations } from "@/lib/repositories/communication-conversation-search-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type ConversationRow = {
  id: number;
  organizationId: number;
  mailboxId: number;

  mailboxName: string;
  mailboxAddress: string;
  mailboxIsDefault: boolean;
  mailboxIsActive: boolean;

  vendorId: number | null;
  assessmentId: number | null;
  assessmentRunId: number | null;
  reviewRequestId: number | null;
  reviewAssignmentId: number | null;

  subject: string;
  status: string;
  priority: string;
  channel: string;
  externalThreadId: string | null;

  lastMessageAt: Date | null;
  closedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;

  messageCount: number;
  inboundMessageCount: number;
  outboundMessageCount: number;
  failedMessageCount: number;

  latestMessageId: number | null;
  latestDirection: string | null;
  latestStatus: string | null;
  latestSubject: string | null;
  latestBodyText: string | null;
  latestBodyHtml: string | null;
  latestFromAddress: string | null;
  latestFromName: string | null;
  latestCreatedAt: Date | null;
  latestActivityAt: Date | null;
};

type CountRow = {
  total: number;
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

function positiveInt(
  value: string | null,
  fallback: number,
) {
  const number = Number(value);

  if (
    !Number.isInteger(number) ||
    number <= 0
  ) {
    return fallback;
  }

  return number;
}

function optionalPositiveInt(
  value: string | null,
) {
  if (!value) {
    return null;
  }

  const number = Number(value);

  if (
    !Number.isInteger(number) ||
    number <= 0
  ) {
    return null;
  }

  return number;
}

function normalizedStatus(
  value: string | null,
) {
  const status =
    String(value ?? "")
      .trim()
      .toUpperCase();

  if (!status || status === "ALL") {
    return null;
  }

  if (
    status !== "OPEN" &&
    status !== "CLOSED"
  ) {
    return "INVALID";
  }

  return status;
}

function normalizedPriority(
  value: string | null,
) {
  const priority =
    String(value ?? "")
      .trim()
      .toUpperCase();

  if (!priority || priority === "ALL") {
    return null;
  }

  const allowed = new Set([
    "LOW",
    "NORMAL",
    "HIGH",
    "URGENT",
  ]);

  return allowed.has(priority)
    ? priority
    : "INVALID";
}

function normalizedChannel(
  value: string | null,
) {
  const channel =
    String(value ?? "")
      .trim()
      .toUpperCase();

  if (!channel || channel === "ALL") {
    return null;
  }

  const allowed = new Set([
    "EMAIL",
    "PORTAL",
    "SYSTEM",
  ]);

  return allowed.has(channel)
    ? channel
    : "INVALID";
}

async function requireApiAuth() {
  const { userId } = await auth();

  if (!userId) {
    return {
      ok: false as const,
      response: json(401, {
        ok: false,
        error: "Unauthorized",
        conversations: [],
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
          conversations: [],
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
          conversations: [],
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
        conversations: [],
      }),
    };
  }
}

function messagePreview(
  bodyText: string | null,
  bodyHtml: string | null,
) {
  const source =
    bodyText?.trim() ||
    bodyHtml
      ?.replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim() ||
    "";

  if (!source) {
    return null;
  }

  return source.length > 240
    ? `${source.slice(0, 237)}...`
    : source;
}

export async function GET(request: Request) {
  const gate = await requireApiAuth();

  if (!gate.ok) {
    return gate.response;
  }

  try {
    const url = new URL(request.url);
    const searchParams = url.searchParams;

    const mailboxId =
      optionalPositiveInt(
        searchParams.get("mailboxId"),
      );

    const vendorId =
      optionalPositiveInt(
        searchParams.get("vendorId"),
      );

    const assessmentId =
      optionalPositiveInt(
        searchParams.get("assessmentId"),
      );

    const assessmentRunId =
      optionalPositiveInt(
        searchParams.get("assessmentRunId"),
      );

    const reviewRequestId =
      optionalPositiveInt(
        searchParams.get("reviewRequestId"),
      );

    const reviewAssignmentId =
      optionalPositiveInt(
        searchParams.get("reviewAssignmentId"),
      );

    const status =
      normalizedStatus(
        searchParams.get("status"),
      );

    const priority =
      normalizedPriority(
        searchParams.get("priority"),
      );

    const channel =
      normalizedChannel(
        searchParams.get("channel"),
      );

    const search =
      String(searchParams.get("search") ?? "")
        .trim()
        .slice(0, 200);

    const page = Math.min(
      positiveInt(
        searchParams.get("page"),
        1,
      ),
      100000,
    );

    const pageSize = Math.min(
      positiveInt(
        searchParams.get("pageSize"),
        30,
      ),
      100,
    );

    if (status === "INVALID") {
      return json(400, {
        ok: false,
        error:
          "Invalid status. Use OPEN, CLOSED, or ALL.",
        conversations: [],
      });
    }

    if (priority === "INVALID") {
      return json(400, {
        ok: false,
        error:
          "Invalid priority. Use LOW, NORMAL, HIGH, URGENT, or ALL.",
        conversations: [],
      });
    }

    if (channel === "INVALID") {
      return json(400, {
        ok: false,
        error:
          "Invalid channel. Use EMAIL, PORTAL, SYSTEM, or ALL.",
        conversations: [],
      });
    }

    if (
      searchParams.has("mailboxId") &&
      !mailboxId
    ) {
      return json(400, {
        ok: false,
        error: "Invalid mailboxId",
        conversations: [],
      });
    }

    const { total, rows } = await searchCommunicationConversations({
      organizationId: gate.organizationId,
      mailboxId,
      vendorId,
      assessmentId,
      assessmentRunId,
      reviewRequestId,
      reviewAssignmentId,
      status,
      priority,
      channel,
      search: search || null,
      page,
      pageSize,
    });

    const conversations =
      rows.map((row) => ({
        id: Number(row.id),
        organizationId:
          Number(row.organizationId),

        mailbox: {
          id: Number(row.mailboxId),
          name: row.mailboxName,
          address: row.mailboxAddress,
          isDefault:
            Boolean(row.mailboxIsDefault),
          isActive:
            Boolean(row.mailboxIsActive),
        },

        links: {
          vendorId:
            row.vendorId == null
              ? null
              : Number(row.vendorId),

          assessmentId:
            row.assessmentId == null
              ? null
              : Number(row.assessmentId),

          assessmentRunId:
            row.assessmentRunId == null
              ? null
              : Number(row.assessmentRunId),

          reviewRequestId:
            row.reviewRequestId == null
              ? null
              : Number(row.reviewRequestId),

          reviewAssignmentId:
            row.reviewAssignmentId == null
              ? null
              : Number(row.reviewAssignmentId),
        },

        subject: row.subject,
        status: row.status,
        priority: row.priority,
        channel: row.channel,

        externalThreadId:
          row.externalThreadId,

        counts: {
          messages:
            Number(row.messageCount ?? 0),
          inbound:
            Number(
              row.inboundMessageCount ?? 0,
            ),
          outbound:
            Number(
              row.outboundMessageCount ?? 0,
            ),
          failed:
            Number(
              row.failedMessageCount ?? 0,
            ),
        },

        latestMessage:
          row.latestMessageId == null
            ? null
            : {
                id:
                  Number(row.latestMessageId),

                direction:
                  row.latestDirection,

                status:
                  row.latestStatus,

                subject:
                  row.latestSubject,

                preview:
                  messagePreview(
                    row.latestBodyText,
                    row.latestBodyHtml,
                  ),

                from: {
                  address:
                    row.latestFromAddress,
                  name:
                    row.latestFromName,
                },

                createdAt:
                  row.latestCreatedAt
                    ? row.latestCreatedAt.toISOString()
                    : null,
              },

        lastMessageAt:
          row.lastMessageAt
            ? row.lastMessageAt.toISOString()
            : null,

        latestActivityAt:
          row.latestActivityAt
            ? row.latestActivityAt.toISOString()
            : null,

        closedAt:
          row.closedAt
            ? row.closedAt.toISOString()
            : null,

        createdAt:
          row.createdAt.toISOString(),

        updatedAt:
          row.updatedAt.toISOString(),
      }));

    const totalPages =
      total === 0
        ? 0
        : Math.ceil(total / pageSize);

    return json(200, {
      ok: true,
      organizationId:
        gate.organizationId,

      filters: {
        mailboxId,
        vendorId,
        assessmentId,
        assessmentRunId,
        reviewRequestId,
        reviewAssignmentId,
        status,
        priority,
        channel,
        search: search || null,
      },

      pagination: {
        page,
        pageSize,
        total,
        totalPages,
        hasPreviousPage:
          page > 1,
        hasNextPage:
          page < totalPages,
      },

      conversations,
    });
  } catch (error) {
    console.error(
      "communications.conversations.get.failed",
      error,
    );

    return json(500, {
      ok: false,
      error:
        "Failed to load communication conversations",
      detail:
        error instanceof Error
          ? error.message
          : "Unknown error",
      conversations: [],
    });
  }
}
