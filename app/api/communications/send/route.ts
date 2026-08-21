import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import {
  sendCommunication,
} from "@/lib/communications";
import { requireDbOrganization } from "@/lib/org-db";
import { getCurrentOrgPlanTier } from "@/lib/billing/plan-access";
import { findCommunicationMailbox } from "@/lib/repositories/communication-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type RequestBody = {
  mailboxId?: unknown;

  conversationId?: unknown;
  replyMessageId?: unknown;

  to?: unknown;
  cc?: unknown;
  bcc?: unknown;
  replyTo?: unknown;

  subject?: unknown;
  text?: unknown;
  html?: unknown;

  priority?: unknown;

  vendorId?: unknown;
  assessmentId?: unknown;
  assessmentRunId?: unknown;
  reviewRequestId?: unknown;
  reviewAssignmentId?: unknown;
  evidenceRequestId?: unknown;
};

type RecipientInput = {
  address: string;
  displayName?: string | null;
};

const EMAIL_PATTERN =
  /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

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
  value: unknown,
): number | null {
  const parsed =
    Number(value);

  if (
    !Number.isInteger(parsed) ||
    parsed <= 0
  ) {
    return null;
  }

  return parsed;
}

function optionalPositiveInt(
  value: unknown,
): number | undefined {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return undefined;
  }

  return (
    positiveInt(value) ??
    undefined
  );
}

function stringValue(
  value: unknown,
): string {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function normalizeAddress(
  value: string,
): string {
  const trimmed =
    value.trim();

  const angleMatch =
    trimmed.match(/<([^>]+)>/);

  return (
    angleMatch?.[1] ||
    trimmed
  )
    .trim()
    .toLowerCase();
}

function displayNameFromValue(
  value: string,
): string | null {
  const trimmed =
    value.trim();

  const match =
    trimmed.match(
      /^\s*"?([^"<]+?)"?\s*<[^>]+>\s*$/,
    );

  const displayName =
    match?.[1]?.trim();

  return displayName || null;
}

function recipientCandidates(
  value: unknown,
): string[] {
  if (
    typeof value === "string"
  ) {
    return value
      .split(/[;,\n]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  if (
    Array.isArray(value)
  ) {
    return value.flatMap(
      recipientCandidates,
    );
  }

  if (
    value &&
    typeof value === "object" &&
    "address" in value
  ) {
    const address =
      stringValue(
        (
          value as {
            address?: unknown;
          }
        ).address,
      );

    const displayName =
      stringValue(
        (
          value as {
            displayName?: unknown;
          }
        ).displayName,
      );

    if (!address) {
      return [];
    }

    return [
      displayName
        ? `${displayName} <${address}>`
        : address,
    ];
  }

  return [];
}

function parseRecipients(
  value: unknown,
): RecipientInput[] {
  const recipients =
    new Map<
      string,
      RecipientInput
    >();

  for (
    const candidate of
    recipientCandidates(value)
  ) {
    const address =
      normalizeAddress(candidate);

    if (
      !EMAIL_PATTERN.test(address)
    ) {
      throw new Error(
        `Invalid email address: ${candidate}`,
      );
    }

    if (
      recipients.has(address)
    ) {
      continue;
    }

    recipients.set(address, {
      address,
      displayName:
        displayNameFromValue(candidate),
    });
  }

  return Array.from(
    recipients.values(),
  );
}

function removeCrossFieldDuplicates(
  to: RecipientInput[],
  cc: RecipientInput[],
  bcc: RecipientInput[],
) {
  const seen =
    new Set<string>();

  const unique = (
    recipients: RecipientInput[],
  ) =>
    recipients.filter(
      (recipient) => {
        if (
          seen.has(recipient.address)
        ) {
          return false;
        }

        seen.add(recipient.address);
        return true;
      },
    );

  return {
    to: unique(to),
    cc: unique(cc),
    bcc: unique(bcc),
  };
}

function recipientValue(
  recipient: RecipientInput,
): string {
  return recipient.displayName
    ? `${recipient.displayName} <${recipient.address}>`
    : recipient.address;
}

function escapeHtml(
  value: string,
): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function textToHtml(
  value: string,
): string {
  return escapeHtml(value)
    .replaceAll(
      "\r\n",
      "\n",
    )
    .replaceAll(
      "\r",
      "\n",
    )
    .split("\n")
    .map(
      (line) =>
        line.length > 0
          ? `<p>${line}</p>`
          : "<p><br /></p>",
    )
    .join("");
}

function validPriority(
  value: unknown,
) {
  const normalized =
    stringValue(value)
      .toUpperCase();

  if (
    normalized === "LOW" ||
    normalized === "HIGH" ||
    normalized === "URGENT"
  ) {
    return normalized;
  }

  return "NORMAL";
}

async function requireApiAuth() {
  const {
    userId,
  } = await auth();

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
    const organization =
      await requireDbOrganization();

    if (
      !("id" in organization)
    ) {
      return {
        ok: false as const,
        response: json(403, {
          ok: false,
          error:
            "Organization required",
        }),
      };
    }

    const organizationId =
      positiveInt(organization.id);

    if (!organizationId) {
      return {
        ok: false as const,
        response: json(403, {
          ok: false,
          error:
            "Valid organization required",
        }),
      };
    }

    const planTier = await getCurrentOrgPlanTier();

    if (
      planTier !== "PRO" &&
      planTier !== "ENTERPRISE"
    ) {
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
        error:
          "Organization required",
      }),
    };
  }
}

export async function POST(
  request: Request,
) {
  const gate =
    await requireApiAuth();

  if (!gate.ok) {
    return gate.response;
  }

  let body: RequestBody;

  try {
    body =
      (await request.json()) as
        RequestBody;
  } catch {
    return json(400, {
      ok: false,
      error:
        "Request body must be valid JSON",
    });
  }

  const mailboxId =
    positiveInt(body.mailboxId);

  if (!mailboxId) {
    return json(400, {
      ok: false,
      error:
        "A valid mailbox is required",
    });
  }

  const conversationId =
    optionalPositiveInt(
      body.conversationId,
    );

  if (
    body.conversationId !== undefined &&
    body.conversationId !== null &&
    body.conversationId !== "" &&
    !conversationId
  ) {
    return json(400, {
      ok: false,
      error:
        "conversationId must be a positive integer",
    });
  }

  const replyMessageId =
    optionalPositiveInt(
      body.replyMessageId,
    );

  if (
    body.replyMessageId !== undefined &&
    body.replyMessageId !== null &&
    body.replyMessageId !== "" &&
    !replyMessageId
  ) {
    return json(400, {
      ok: false,
      error:
        "replyMessageId must be a positive integer",
    });
  }

  if (
    replyMessageId &&
    !conversationId
  ) {
    return json(400, {
      ok: false,
      error:
        "conversationId is required when replying to a message",
    });
  }

  const mailbox =
    await findCommunicationMailbox({
      where: {
        id: mailboxId,
        organizationId:
          gate.organizationId,
        isActive: true,
      },

      select: {
        id: true,
        name: true,
        address: true,
      },
    });

  if (!mailbox) {
    return json(404, {
      ok: false,
      error:
        "Communication mailbox not found",
    });
  }

  let parsedRecipients: {
    to: RecipientInput[];
    cc: RecipientInput[];
    bcc: RecipientInput[];
  };

  try {
    parsedRecipients =
      removeCrossFieldDuplicates(
        parseRecipients(body.to),
        parseRecipients(body.cc),
        parseRecipients(body.bcc),
      );
  } catch (error) {
    return json(400, {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Invalid recipient",
    });
  }

  if (
    parsedRecipients.to.length === 0
  ) {
    return json(400, {
      ok: false,
      error:
        "At least one TO recipient is required",
    });
  }

  const subject =
    stringValue(body.subject);

  if (!subject) {
    return json(400, {
      ok: false,
      error:
        "A subject is required",
    });
  }

  if (
    subject.length > 500
  ) {
    return json(400, {
      ok: false,
      error:
        "Subject cannot exceed 500 characters",
    });
  }

  const text =
    stringValue(body.text);

  const requestedHtml =
    stringValue(body.html);

  const html =
    requestedHtml ||
    (
      text
        ? textToHtml(text)
        : ""
    );

  if (
    !text &&
    !html
  ) {
    return json(400, {
      ok: false,
      error:
        "A message body is required",
    });
  }

  const replyTo =
    stringValue(body.replyTo);

  if (
    replyTo &&
    !EMAIL_PATTERN.test(
      normalizeAddress(replyTo),
    )
  ) {
    return json(400, {
      ok: false,
      error:
        "Reply-To must be a valid email address",
    });
  }

  try {
    const result =
      await sendCommunication({
        organizationId:
          gate.organizationId,

        mailboxId:
          mailbox.id,

        conversationId,

        replyMessageId,

        to:
          parsedRecipients.to
            .map(recipientValue)
            .join(", "),

        cc:
          parsedRecipients.cc.map(
            recipientValue,
          ),

        bcc:
          parsedRecipients.bcc.map(
            recipientValue,
          ),

        replyTo:
          replyTo
            ? normalizeAddress(replyTo)
            : undefined,

        subject,

        text:
          text || undefined,

        html,

        priority:
          validPriority(
            body.priority,
          ),

        channel: "EMAIL",

        context: {
          organizationId:
            gate.organizationId,

          vendorId:
            optionalPositiveInt(
              body.vendorId,
            ),

          assessmentId:
            optionalPositiveInt(
              body.assessmentId,
            ),

          assessmentRunId:
            optionalPositiveInt(
              body.assessmentRunId,
            ),

          reviewRequestId:
            optionalPositiveInt(
              body.reviewRequestId,
            ),

          reviewAssignmentId:
            optionalPositiveInt(
              body.reviewAssignmentId,
            ),

          evidenceRequestId:
            optionalPositiveInt(
              body.evidenceRequestId,
            ),
        },
      });

    return json(201, {
      ok: true,

      mailbox: {
        id:
          mailbox.id,

        name:
          mailbox.name,

        address:
          mailbox.address,
      },

      conversationId:
        result.conversationId,

      messageId:
        result.messageId,

      provider:
        result.provider,

      providerMessageId:
        result.providerMessageId,

      simulated:
        result.simulated,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown communication provider error";

    console.error(
      "[communications/send] outbound send failed",
      {
        organizationId:
          gate.organizationId,
        mailboxId:
          mailbox.id,
        message,
        error,
      },
    );

    return json(500, {
      ok: false,
      error:
        process.env.NODE_ENV !== "production"
          ? message
          : "The communication could not be sent",
    });
  }
}
