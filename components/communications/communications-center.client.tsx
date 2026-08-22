"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

type Mailbox = {
  id: number;
  name: string;
  address: string;
  description?: string | null;
  isDefault: boolean;
  isActive: boolean;
};

type ConversationSummary = {
  id: number;
  subject: string;
  status: string;
  priority: string;
  channel: string;

  mailbox: {
    id: number;
    name: string;
    address: string;
    isDefault: boolean;
    isActive: boolean;
  };

  links: {
    vendorId: number | null;
    assessmentId: number | null;
    assessmentRunId: number | null;
    reviewRequestId: number | null;
    reviewAssignmentId: number | null;
  };

  counts: {
    messages: number;
    inbound: number;
    outbound: number;
    failed: number;
  };

  latestMessage: {
    id: number;
    direction: string | null;
    status: string | null;
    subject: string | null;
    preview: string | null;
    from: {
      address: string | null;
      name: string | null;
    };
    createdAt: string | null;
  } | null;

  lastMessageAt: string | null;
  latestActivityAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type Pagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
};

type ConversationDetail = {
  id: number;
  subject: string;
  status: string;
  priority: string;
  channel: string;
  externalThreadId: string | null;

  mailbox: {
    id: number;
    name: string;
    address: string;
    description: string | null;
    isDefault: boolean;
    isActive: boolean;
  };

  linkedRecords: {
    vendor: {
      id: number;
      name: string | null;
    } | null;

    assessment: {
      id: number;
      name: string | null;
      status: string | null;
    } | null;

    assessmentRun: {
      id: number;
      status: string | null;
    } | null;

    reviewRequest: {
      id: number;
      status: string | null;
    } | null;

    reviewAssignment: {
      id: number;
      status: string | null;
      assignmentType: string | null;
      reviewer: string | null;
    } | null;
  };

  counts: {
    total: number;
    inbound: number;
    outbound: number;
    internal: number;
    failed: number;
  };

  lastMessageAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type CommunicationRecipient = {
  kind: "TO" | "CC";
  address: string;
  displayName: string | null;
};

type ConversationMessage = {
  id: number;
  direction: string;
  channel: string;
  status: string;

  subject: string | null;

  body: {
    text: string | null;
    html: string | null;
  };

  from: {
    address: string | null;
    name: string | null;
  };

  replyToAddress: string | null;

  recipients: CommunicationRecipient[];

  threading: {
    externalThreadId: string | null;
    provider: string | null;
    providerMessageId: string | null;
    internetMessageId: string | null;
    inReplyToMessageId: string | null;
  };

  delivery: {
    queuedAt: string | null;
    sentAt: string | null;
    deliveredAt: string | null;
    receivedAt: string | null;
    failedAt: string | null;

    error: {
      code: string | null;
      message: string | null;
    } | null;
  };

  activityAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type MailboxesResponse = {
  ok?: boolean;
  error?: string;
  mailboxes?: Mailbox[];
};

type ConversationsResponse = {
  ok?: boolean;
  error?: string;
  conversations?: ConversationSummary[];
  pagination?: Pagination;
};

type ConversationDetailResponse = {
  ok?: boolean;
  error?: string;
  detail?: string;
  conversation?: ConversationDetail;
  messages?: ConversationMessage[];
};

type SendCommunicationResponse = {
  ok?: boolean;
  error?: string;

  conversationId?: number;
  messageId?: number;

  mailbox?: {
    id: number;
    name: string;
    address: string;
  };

  provider?: string;
  providerMessageId?: string | null;
  simulated?: boolean;
};

type DeleteConversationResponse = {
  ok?: boolean;
  error?: string;
  deletedConversationId?: number;
};

type Props = {
  organizationId: number;
};

function formatDate(value: string | null) {
  if (!value) {
    return "Not recorded";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown date";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year:
      date.getFullYear() !==
      new Date().getFullYear()
        ? "numeric"
        : undefined,
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function statusTone(status: string | null | undefined) {
  const normalized =
    String(status || "").toUpperCase();

  if (
    normalized === "OPEN" ||
    normalized === "DELIVERED" ||
    normalized === "RECEIVED" ||
    normalized === "SENT"
  ) {
    return "border-cyan-400/30 bg-cyan-400/10 text-cyan-200";
  }

  if (
    normalized === "FAILED" ||
    normalized === "BOUNCED"
  ) {
    return "border-rose-400/30 bg-rose-400/10 text-rose-200";
  }

  if (
    normalized === "QUEUED" ||
    normalized === "PENDING"
  ) {
    return "border-amber-400/30 bg-amber-400/10 text-amber-200";
  }

  if (normalized === "CLOSED") {
    return "border-slate-400/30 bg-slate-400/10 text-slate-300";
  }

  return "border-white/10 bg-white/[0.04] text-slate-300";
}

function priorityTone(priority: string) {
  const normalized =
    String(priority || "").toUpperCase();

  if (normalized === "URGENT") {
    return "border-rose-400/30 bg-rose-400/10 text-rose-200";
  }

  if (normalized === "HIGH") {
    return "border-amber-400/30 bg-amber-400/10 text-amber-200";
  }

  if (normalized === "LOW") {
    return "border-slate-400/30 bg-slate-400/10 text-slate-300";
  }

  return "border-cyan-400/20 bg-cyan-400/[0.06] text-cyan-100";
}

function directionTone(direction: string) {
  const normalized =
    String(direction || "").toUpperCase();

  if (normalized === "INBOUND") {
    return {
      border:
        "border-cyan-400/20",
      background:
        "bg-cyan-400/[0.055]",
      badge:
        "border-cyan-400/30 bg-cyan-400/10 text-cyan-200",
      alignment:
        "mr-auto",
    };
  }

  if (normalized === "INTERNAL") {
    return {
      border:
        "border-violet-400/20",
      background:
        "bg-violet-400/[0.055]",
      badge:
        "border-violet-400/30 bg-violet-400/10 text-violet-200",
      alignment:
        "mx-auto",
    };
  }

  return {
    border:
      "border-emerald-400/20",
    background:
      "bg-emerald-400/[0.045]",
    badge:
      "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
    alignment:
      "ml-auto",
  };
}

function recipientDisplay(
  message: ConversationMessage,
  kind: "TO" | "CC",
) {
  const recipients =
    message.recipients
      .filter(
        (recipient) =>
          recipient.kind === kind,
      )
      .map((recipient) => {
        const name =
          String(
            recipient.displayName ||
            "",
          ).trim();

        const address =
          String(
            recipient.address ||
            "",
          ).trim();

        if (
          name &&
          address
        ) {
          return `${name} <${address}>`;
        }

        return address || name;
      })
      .filter(Boolean);

  return recipients.length > 0
    ? recipients.join(", ")
    : "Not recorded";
}

function messageBody(message: ConversationMessage) {
  const text =
    String(
      message.body.text ||
      "",
    ).trim();

  if (text) {
    return text;
  }

  const html =
    String(
      message.body.html ||
      "",
    )
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .trim();

  return html || "No message body was recorded.";
}

type MessageComposerAction =
  | "REPLY"
  | "REPLY_ALL"
  | "FORWARD";

function messageRecipientAddresses(
  message: ConversationMessage,
  kind: "TO" | "CC",
) {
  return message.recipients
    .filter(
      (recipient) =>
        recipient.kind === kind,
    )
    .map(
      (recipient) =>
        String(
          recipient.address ||
          "",
        ).trim(),
    )
    .filter(Boolean);
}

function uniqueEmailAddresses(
  values: Array<
    string | null | undefined
  >,
  excludedAddresses: string[] = [],
) {
  const excluded =
    new Set(
      excludedAddresses
        .map(
          (address) =>
            address
              .trim()
              .toLowerCase(),
        )
        .filter(Boolean),
    );

  const seen =
    new Set<string>();

  const result: string[] = [];

  for (const rawValue of values) {
    const address =
      String(
        rawValue ||
        "",
      ).trim();

    const normalized =
      address.toLowerCase();

    if (
      !address ||
      excluded.has(normalized) ||
      seen.has(normalized)
    ) {
      continue;
    }

    seen.add(normalized);
    result.push(address);
  }

  return result;
}

function prefixedSubject(
  subject: string | null,
  prefix: "Re" | "Fwd",
) {
  const value =
    String(
      subject ||
      "Message",
    ).trim() ||
    "Message";

  const prefixPattern =
    prefix === "Re"
      ? /^re:\s*/i
      : /^(fwd|fw):\s*/i;

  return prefixPattern.test(value)
    ? value
    : `${prefix}: ${value}`;
}

function quotedMessageContext(
  message: ConversationMessage,
  label:
    | "Original message"
    | "Forwarded message",
) {
  const sender =
    message.from.name &&
    message.from.address
      ? `${message.from.name} <${message.from.address}>`
      : message.from.address ||
        message.from.name ||
        "Unknown sender";

  const to =
    recipientDisplay(
      message,
      "TO",
    );

  const cc =
    recipientDisplay(
      message,
      "CC",
    );

  const lines = [
    "",
    "",
    `--- ${label} ---`,
    `From: ${sender}`,
    `Date: ${formatDate(message.activityAt)}`,
    `Subject: ${message.subject || "Message"}`,
    `To: ${to}`,
  ];

  if (cc !== "Not recorded") {
    lines.push(`CC: ${cc}`);
  }

  lines.push(
    "",
    messageBody(message),
  );

  return lines.join("\n");
}

export default function CommunicationsCenter({
  organizationId,
}: Props) {
  const [mailboxes, setMailboxes] =
    useState<Mailbox[]>([]);

  const [
    selectedMailboxId,
    setSelectedMailboxId,
  ] = useState<number | null>(null);

  const [conversations, setConversations] =
    useState<ConversationSummary[]>([]);

  const [
    selectedConversationId,
    setSelectedConversationId,
  ] = useState<number | null>(null);

  const [
    conversationDetail,
    setConversationDetail,
  ] = useState<ConversationDetail | null>(null);

  const [messages, setMessages] =
    useState<ConversationMessage[]>([]);

  const [status, setStatus] =
    useState("OPEN");

  const [searchInput, setSearchInput] =
    useState("");

  const [search, setSearch] =
    useState("");

  const [page, setPage] =
    useState(1);

  const [pagination, setPagination] =
    useState<Pagination>({
      page: 1,
      pageSize: 30,
      total: 0,
      totalPages: 0,
      hasPreviousPage: false,
      hasNextPage: false,
    });

  const [loadingMailboxes, setLoadingMailboxes] =
    useState(true);

  const [loadingConversations, setLoadingConversations] =
    useState(true);

  const [loadingDetail, setLoadingDetail] =
    useState(false);

  const [refreshing, setRefreshing] =
    useState(false);

  const [refreshingDetail, setRefreshingDetail] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const [detailError, setDetailError] =
    useState<string | null>(null);

  const [composerOpen, setComposerOpen] =
    useState(false);

  const [
    composerMailboxId,
    setComposerMailboxId,
  ] = useState<number | null>(null);

  const [composerTo, setComposerTo] =
    useState("");

  const [composerCc, setComposerCc] =
    useState("");

  const [composerBcc, setComposerBcc] =
    useState("");

  const [
    composerReplyTo,
    setComposerReplyTo,
  ] = useState("");

  const [
    composerConversationId,
    setComposerConversationId,
  ] = useState<number | null>(null);

  const [
    composerReplyMessageId,
    setComposerReplyMessageId,
  ] = useState<number | null>(null);

  const [
    composerSubject,
    setComposerSubject,
  ] = useState("");

  const [
    composerMessage,
    setComposerMessage,
  ] = useState("");

  const [
    composerPriority,
    setComposerPriority,
  ] = useState("NORMAL");

  const [sendingMessage, setSendingMessage] =
    useState(false);

  const [
    deleteConversationId,
    setDeleteConversationId,
  ] = useState<number | null>(null);

  const [
    deletingConversation,
    setDeletingConversation,
  ] = useState(false);

  const [
    deleteConversationError,
    setDeleteConversationError,
  ] = useState<string | null>(null);

  const [
    composerError,
    setComposerError,
  ] = useState<string | null>(null);

  const loadMailboxes =
    useCallback(async () => {
      setLoadingMailboxes(true);

      try {
        const response =
          await fetch(
            "/api/communications/mailboxes",
            {
              cache: "no-store",
            },
          );

        const body =
          await response.json() as MailboxesResponse;

        if (!response.ok || !body.ok) {
          throw new Error(
            body.error ||
            "Failed to load communication mailboxes.",
          );
        }

        const nextMailboxes =
          Array.isArray(body.mailboxes)
            ? body.mailboxes
            : [];

        setMailboxes(nextMailboxes);

        setSelectedMailboxId(
          (current) => {
            if (
              current &&
              nextMailboxes.some(
                (mailbox) =>
                  mailbox.id === current,
              )
            ) {
              return current;
            }

            const defaultMailbox =
              nextMailboxes.find(
                (mailbox) =>
                  mailbox.isDefault &&
                  mailbox.isActive,
              );

            return (
              defaultMailbox?.id ??
              nextMailboxes.find(
                (mailbox) =>
                  mailbox.isActive,
              )?.id ??
              nextMailboxes[0]?.id ??
              null
            );
          },
        );
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Failed to load mailboxes.",
        );
      } finally {
        setLoadingMailboxes(false);
      }
    }, []);

  const loadConversations =
    useCallback(
      async ({
        quiet = false,
      }: {
        quiet?: boolean;
      } = {}) => {
        if (quiet) {
          setRefreshing(true);
        } else {
          setLoadingConversations(true);
        }

        setError(null);

        try {
          const params =
            new URLSearchParams();

          params.set(
            "page",
            String(page),
          );

          params.set(
            "pageSize",
            "30",
          );

          if (selectedMailboxId) {
            params.set(
              "mailboxId",
              String(selectedMailboxId),
            );
          }

          if (status !== "ALL") {
            params.set(
              "status",
              status,
            );
          }

          if (search) {
            params.set(
              "search",
              search,
            );
          }

          const response =
            await fetch(
              `/api/communications/conversations?${params.toString()}`,
              {
                cache: "no-store",
              },
            );

          const body =
            await response.json() as ConversationsResponse;

          if (!response.ok || !body.ok) {
            throw new Error(
              body.error ||
              "Failed to load communication conversations.",
            );
          }

          const nextConversations =
            Array.isArray(body.conversations)
              ? body.conversations
              : [];

          setConversations(
            nextConversations,
          );

          if (body.pagination) {
            setPagination(
              body.pagination,
            );
          } else {
            setPagination({
              page,
              pageSize: 30,
              total:
                nextConversations.length,
              totalPages:
                nextConversations.length > 0
                  ? 1
                  : 0,
              hasPreviousPage:
                false,
              hasNextPage:
                false,
            });
          }

          setSelectedConversationId(
            (current) => {
              if (
                current &&
                nextConversations.some(
                  (conversation) =>
                    conversation.id === current,
                )
              ) {
                return current;
              }

              return (
                nextConversations[0]?.id ??
                null
              );
            },
          );
        } catch (loadError) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Failed to load conversations.",
          );

          setConversations([]);
          setSelectedConversationId(null);
        } finally {
          setLoadingConversations(false);
          setRefreshing(false);
        }
      },
      [
        page,
        search,
        selectedMailboxId,
        status,
      ],
    );

  const loadConversationDetail =
    useCallback(
      async (
        conversationId: number,
        {
          quiet = false,
        }: {
          quiet?: boolean;
        } = {},
      ) => {
        if (quiet) {
          setRefreshingDetail(true);
        } else {
          setLoadingDetail(true);
        }

        setDetailError(null);

        try {
          const response =
            await fetch(
              `/api/communications/conversations/${conversationId}`,
              {
                cache: "no-store",
              },
            );

          const body =
            await response.json() as ConversationDetailResponse;

          if (!response.ok || !body.ok) {
            throw new Error(
              body.error ||
              "Failed to load conversation detail.",
            );
          }

          if (!body.conversation) {
            throw new Error(
              "Conversation detail was not returned.",
            );
          }

          setConversationDetail(
            body.conversation,
          );

          setMessages(
            Array.isArray(body.messages)
              ? body.messages
              : [],
          );
        } catch (loadError) {
          setDetailError(
            loadError instanceof Error
              ? loadError.message
              : "Failed to load conversation detail.",
          );

          setConversationDetail(null);
          setMessages([]);
        } finally {
          setLoadingDetail(false);
          setRefreshingDetail(false);
        }
      },
      [],
    );

  useEffect(() => {
    void loadMailboxes();
  }, [loadMailboxes]);

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if (!selectedConversationId) {
      setConversationDetail(null);
      setMessages([]);
      setDetailError(null);
      return;
    }

    void loadConversationDetail(
      selectedConversationId,
    );
  }, [
    loadConversationDetail,
    selectedConversationId,
  ]);

  const selectedConversation =
    useMemo(
      () =>
        conversations.find(
          (conversation) =>
            conversation.id ===
            selectedConversationId,
        ) ?? null,
      [
        conversations,
        selectedConversationId,
      ],
    );

  function resetComposer() {
    setComposerTo("");
    setComposerCc("");
    setComposerBcc("");
    setComposerReplyTo("");
    setComposerConversationId(null);
    setComposerReplyMessageId(null);
    setComposerSubject("");
    setComposerMessage("");
    setComposerPriority("NORMAL");
    setComposerError(null);
  }

  function openComposer() {
    const defaultMailbox =
      mailboxes.find(
        (mailbox) =>
          mailbox.id === selectedMailboxId &&
          mailbox.isActive,
      ) ??
      mailboxes.find(
        (mailbox) =>
          mailbox.isDefault &&
          mailbox.isActive,
      ) ??
      mailboxes.find(
        (mailbox) =>
          mailbox.isActive,
      ) ??
      null;

    resetComposer();

    setComposerMailboxId(
      defaultMailbox?.id ??
      null,
    );

    setComposerReplyTo(
      defaultMailbox?.address ??
      "",
    );

    setComposerOpen(true);
  }

  function openMessageComposer(
    action: MessageComposerAction,
    message: ConversationMessage,
  ) {
    const conversationMailbox =
      conversationDetail
        ? mailboxes.find(
            (mailbox) =>
              mailbox.id ===
                conversationDetail.mailbox.id &&
              mailbox.isActive,
          )
        : null;

    const composerMailbox =
      conversationMailbox ??
      mailboxes.find(
        (mailbox) =>
          mailbox.id ===
            selectedMailboxId &&
          mailbox.isActive,
      ) ??
      mailboxes.find(
        (mailbox) =>
          mailbox.isDefault &&
          mailbox.isActive,
      ) ??
      mailboxes.find(
        (mailbox) =>
          mailbox.isActive,
      ) ??
      null;

    const mailboxAddresses =
      mailboxes
        .map(
          (mailbox) =>
            mailbox.address,
        )
        .filter(Boolean);

    const direction =
      String(
        message.direction ||
        "",
      ).toUpperCase();

    const replyTarget =
      message.replyToAddress ||
      message.from.address ||
      null;

    const originalTo =
      messageRecipientAddresses(
        message,
        "TO",
      );

    const originalCc =
      messageRecipientAddresses(
        message,
        "CC",
      );

    resetComposer();

    if (action !== "FORWARD") {
      const replyConversationId =
        conversationDetail?.id ??
        selectedConversationId;

      if (!replyConversationId) {
        setComposerError(
          "The selected conversation could not be resolved.",
        );

        return;
      }

      setComposerConversationId(
        replyConversationId,
      );

      setComposerReplyMessageId(
        message.id,
      );
    }

    setComposerMailboxId(
      composerMailbox?.id ??
      null,
    );

    setComposerReplyTo(
      composerMailbox?.address ??
      "",
    );

    setComposerPriority(
      conversationDetail?.priority ||
      "NORMAL",
    );

    if (action === "FORWARD") {
      setComposerTo("");
      setComposerCc("");
      setComposerBcc("");

      setComposerSubject(
        prefixedSubject(
          message.subject,
          "Fwd",
        ),
      );

      setComposerMessage(
        quotedMessageContext(
          message,
          "Forwarded message",
        ),
      );

      setComposerOpen(true);
      return;
    }

    if (action === "REPLY") {
      const replyRecipients =
        direction === "INBOUND"
          ? uniqueEmailAddresses(
              [replyTarget],
              mailboxAddresses,
            )
          : uniqueEmailAddresses(
              originalTo,
              mailboxAddresses,
            );

      setComposerTo(
        replyRecipients.join(", "),
      );

      setComposerCc("");
      setComposerBcc("");

      setComposerSubject(
        prefixedSubject(
          message.subject,
          "Re",
        ),
      );

      setComposerMessage(
        quotedMessageContext(
          message,
          "Original message",
        ),
      );

      setComposerOpen(true);
      return;
    }

    const primaryRecipients =
      direction === "INBOUND"
        ? uniqueEmailAddresses(
            [replyTarget],
            mailboxAddresses,
          )
        : uniqueEmailAddresses(
            originalTo,
            mailboxAddresses,
          );

    const copiedRecipients =
      direction === "INBOUND"
        ? uniqueEmailAddresses(
            [
              ...originalTo,
              ...originalCc,
            ],
            [
              ...mailboxAddresses,
              ...primaryRecipients,
            ],
          )
        : uniqueEmailAddresses(
            originalCc,
            [
              ...mailboxAddresses,
              ...primaryRecipients,
            ],
          );

    setComposerTo(
      primaryRecipients.join(", "),
    );

    setComposerCc(
      copiedRecipients.join(", "),
    );

    setComposerBcc("");

    setComposerSubject(
      prefixedSubject(
        message.subject,
        "Re",
      ),
    );

    setComposerMessage(
      quotedMessageContext(
        message,
        "Original message",
      ),
    );

    setComposerOpen(true);
  }

  function closeComposer() {
    if (sendingMessage) {
      return;
    }

    setComposerOpen(false);
    resetComposer();
  }

  async function sendComposedMessage(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!composerMailboxId) {
      setComposerError(
        "Select an active communication mailbox.",
      );

      return;
    }

    if (!composerTo.trim()) {
      setComposerError(
        "Enter at least one recipient.",
      );

      return;
    }

    if (!composerSubject.trim()) {
      setComposerError(
        "Enter a subject.",
      );

      return;
    }

    if (!composerMessage.trim()) {
      setComposerError(
        "Enter a message.",
      );

      return;
    }

    setSendingMessage(true);
    setComposerError(null);

    try {
      const response =
        await fetch(
          "/api/communications/send",
          {
            method: "POST",

            headers: {
              "content-type":
                "application/json",
            },

            body: JSON.stringify({
              mailboxId:
                composerMailboxId,

              conversationId:
                composerConversationId ??
                undefined,

              replyMessageId:
                composerReplyMessageId ??
                undefined,

              to:
                composerTo,

              cc:
                composerCc,

              bcc:
                composerBcc,

              replyTo:
                composerReplyTo,

              subject:
                composerSubject,

              text:
                composerMessage,

              priority:
                composerPriority,
            }),
          },
        );

      const body =
        await response.json() as
          SendCommunicationResponse;

      if (
        !response.ok ||
        !body.ok
      ) {
        throw new Error(
          body.error ||
          "The communication could not be sent.",
        );
      }

      if (
        !body.conversationId
      ) {
        throw new Error(
          "The sent conversation was not returned.",
        );
      }

      const sentConversationId =
        body.conversationId;

      setComposerOpen(false);
      resetComposer();

      setSelectedMailboxId(
        composerMailboxId,
      );

      setPage(1);
      setStatus("OPEN");
      setSearchInput("");
      setSearch("");

      setSelectedConversationId(
        sentConversationId,
      );

      await loadConversationDetail(
        sentConversationId,
      );

      void loadConversations({
        quiet: true,
      });
    } catch (sendError) {
      setComposerError(
        sendError instanceof Error
          ? sendError.message
          : "The communication could not be sent.",
      );
    } finally {
      setSendingMessage(false);
    }
  }

  function requestDeleteConversation(
    conversationId: number,
  ) {
    if (deletingConversation) {
      return;
    }

    setDeleteConversationError(null);
    setDeleteConversationId(
      conversationId,
    );
  }

  function cancelDeleteConversation() {
    if (deletingConversation) {
      return;
    }

    setDeleteConversationError(null);
    setDeleteConversationId(null);
  }

  async function deleteConversation() {
    if (
      !deleteConversationId ||
      deletingConversation
    ) {
      return;
    }

    setDeletingConversation(true);
    setDeleteConversationError(null);

    try {
      const response =
        await fetch(
          `/api/communications/conversations/${deleteConversationId}`,
          {
            method: "DELETE",
          },
        );

      const body =
        await response.json() as
          DeleteConversationResponse;

      if (
        !response.ok ||
        !body.ok
      ) {
        throw new Error(
          body.error ||
          "The conversation could not be deleted.",
        );
      }

      const deletedId =
        body.deletedConversationId ??
        deleteConversationId;

      setConversations(
        (current) =>
          current.filter(
            (conversation) =>
              conversation.id !== deletedId,
          ),
      );

      setSelectedConversationId(
        (current) =>
          current === deletedId
            ? null
            : current,
      );

      setConversationDetail(
        (current) =>
          current?.id === deletedId
            ? null
            : current,
      );

      setMessages([]);
      setDeleteConversationId(null);

      await loadConversations({
        quiet: true,
      });
    } catch (deleteError) {
      setDeleteConversationError(
        deleteError instanceof Error
          ? deleteError.message
          : "The conversation could not be deleted.",
      );
    } finally {
      setDeletingConversation(false);
    }
  }

  function submitSearch(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setPage(1);
    setSearch(
      searchInput.trim(),
    );
  }

  function clearSearch() {
    setSearchInput("");
    setSearch("");
    setPage(1);
  }

  return (
    <section className="mt-8 overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.035] shadow-2xl shadow-cyan-950/20">
      <div className="border-b border-white/10 p-4 sm:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.26em] text-slate-500">
              Organization #{organizationId}
            </p>

            <h2 className="mt-2 text-xl font-semibold text-white">
              Mailboxes and conversation activity
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-white/10 bg-slate-950/50 px-3 py-1.5 text-xs text-slate-300">
              {pagination.total} conversations
            </span>

            <button
              type="button"
              onClick={openComposer}
              disabled={
                loadingMailboxes ||
                !mailboxes.some(
                  (mailbox) =>
                    mailbox.isActive,
                )
              }
              className="inline-flex min-h-10 items-center justify-center rounded-full bg-cyan-300 px-5 py-2 text-xs font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              New message
            </button>

            <button
              type="button"
              onClick={() =>
                void loadConversations({
                  quiet: true,
                })
              }
              disabled={refreshing}
              className="inline-flex min-h-10 items-center justify-center rounded-full border border-white/15 px-4 py-2 text-xs font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {refreshing
                ? "Refreshing..."
                : "Refresh inbox"}
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-3 xl:grid-cols-[240px_180px_minmax(260px,1fr)]">
          <label className="block">
            <span className="sr-only">
              Select mailbox
            </span>

            <select
              value={
                selectedMailboxId ??
                ""
              }
              onChange={(event) => {
                const nextValue =
                  Number(event.target.value);

                setSelectedMailboxId(
                  Number.isInteger(nextValue) &&
                  nextValue > 0
                    ? nextValue
                    : null,
                );

                setPage(1);
              }}
              disabled={
                loadingMailboxes ||
                mailboxes.length === 0
              }
              className="min-h-11 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 text-sm text-white outline-none transition focus:border-cyan-400/50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loadingMailboxes ? (
                <option value="">
                  Loading mailboxes...
                </option>
              ) : null}

              {!loadingMailboxes &&
              mailboxes.length === 0 ? (
                <option value="">
                  No mailboxes available
                </option>
              ) : null}

              {mailboxes.map(
                (mailbox) => (
                  <option
                    key={mailbox.id}
                    value={mailbox.id}
                  >
                    {mailbox.name}
                    {mailbox.isDefault ? " - Default" : ""}
                  </option>
                ),
              )}
            </select>
          </label>

          <label className="block">
            <span className="sr-only">
              Filter by status
            </span>

            <select
              value={status}
              onChange={(event) => {
                setStatus(
                  event.target.value,
                );

                setPage(1);
              }}
              className="min-h-11 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 text-sm text-white outline-none transition focus:border-cyan-400/50"
            >
              <option value="OPEN">
                Open
              </option>

              <option value="CLOSED">
                Closed
              </option>

              <option value="ALL">
                All statuses
              </option>
            </select>
          </label>

          <form
            onSubmit={submitSearch}
            className="flex min-w-0 gap-2"
          >
            <input
              value={searchInput}
              onChange={(event) =>
                setSearchInput(
                  event.target.value,
                )
              }
              placeholder="Search subjects, messages, senders..."
              className="min-h-11 min-w-0 flex-1 rounded-2xl border border-white/10 bg-slate-950/70 px-4 text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-400/50"
            />

            {search ? (
              <button
                type="button"
                onClick={clearSearch}
                className="min-h-11 rounded-2xl border border-white/10 px-4 text-sm text-slate-300 transition hover:bg-white/10 hover:text-white"
              >
                Clear
              </button>
            ) : null}

            <button
              type="submit"
              className="min-h-11 rounded-2xl bg-cyan-300 px-5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
            >
              Search
            </button>
          </form>
        </div>
      </div>

      {error ? (
        <div className="border-b border-rose-400/20 bg-rose-500/10 px-5 py-4">
          <p className="text-sm font-semibold text-rose-100">
            Communications could not be loaded
          </p>

          <p className="mt-1 text-sm text-rose-200/80">
            {error}
          </p>
        </div>
      ) : null}

      <div className="grid min-h-[680px] lg:grid-cols-[420px_minmax(0,1fr)]">
        <aside className="border-b border-white/10 lg:border-b-0 lg:border-r">
          <div className="border-b border-white/10 px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
              Conversations
            </p>

            <p className="mt-1 text-sm text-slate-300">
              Select a thread to inspect its governance context.
            </p>
          </div>

          {loadingConversations ? (
            <ConversationLoadingState />
          ) : conversations.length === 0 ? (
            <ConversationEmptyState
              hasSearch={Boolean(search)}
              hasMailboxes={
                mailboxes.length > 0
              }
            />
          ) : (
            <>
              <div className="max-h-[680px] divide-y divide-white/10 overflow-y-auto">
                {conversations.map(
                  (conversation) => {
                    const active =
                      conversation.id ===
                      selectedConversationId;

                    return (
                      <button
                        key={conversation.id}
                        type="button"
                        onClick={() =>
                          setSelectedConversationId(
                            conversation.id,
                          )
                        }
                        className={[
                          "w-full px-5 py-5 text-left transition",
                          active
                            ? "bg-cyan-400/[0.10]"
                            : "hover:bg-white/[0.04]",
                        ].join(" ")}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-white">
                              {conversation.subject}
                            </p>

                            <p className="mt-1 truncate text-xs text-slate-400">
                              {conversation.latestMessage?.from.name ||
                               conversation.latestMessage?.from.address ||
                               conversation.mailbox.address}
                            </p>
                          </div>

                          <span className="shrink-0 text-[11px] text-slate-500">
                            {formatDate(
                              conversation.latestActivityAt,
                            )}
                          </span>
                        </div>

                        <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-300">
                          {conversation.latestMessage?.preview ||
                           "No message preview is available."}
                        </p>

                        <div className="mt-4 flex flex-wrap items-center gap-2">
                          <span
                            className={[
                              "rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.15em]",
                              statusTone(
                                conversation.status,
                              ),
                            ].join(" ")}
                          >
                            {conversation.status}
                          </span>

                          <span
                            className={[
                              "rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.15em]",
                              priorityTone(
                                conversation.priority,
                              ),
                            ].join(" ")}
                          >
                            {conversation.priority}
                          </span>

                          <span className="rounded-full border border-white/10 bg-slate-950/50 px-2.5 py-1 text-[10px] text-slate-400">
                            {conversation.counts.messages} messages
                          </span>

                          {conversation.counts.failed > 0 ? (
                            <span className="rounded-full border border-rose-400/30 bg-rose-400/10 px-2.5 py-1 text-[10px] font-semibold text-rose-200">
                              {conversation.counts.failed} failed
                            </span>
                          ) : null}
                        </div>
                      </button>
                    );
                  },
                )}
              </div>

              <div className="flex items-center justify-between gap-3 border-t border-white/10 p-4">
                <button
                  type="button"
                  disabled={
                    !pagination.hasPreviousPage
                  }
                  onClick={() =>
                    setPage(
                      (current) =>
                        Math.max(
                          1,
                          current - 1,
                        ),
                    )
                  }
                  className="rounded-full border border-white/10 px-4 py-2 text-xs font-semibold text-slate-300 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Previous
                </button>

                <span className="text-xs text-slate-500">
                  Page {pagination.page}
                  {pagination.totalPages > 0
                    ? ` of ${pagination.totalPages}`
                    : ""}
                </span>

                <button
                  type="button"
                  disabled={
                    !pagination.hasNextPage
                  }
                  onClick={() =>
                    setPage(
                      (current) =>
                        current + 1,
                    )
                  }
                  className="rounded-full border border-white/10 px-4 py-2 text-xs font-semibold text-slate-300 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </>
          )}
        </aside>

        <div className="min-w-0">
          {loadingDetail ? (
            <ConversationDetailLoadingState />
          ) : detailError ? (
            <ConversationDetailErrorState
              error={detailError}
              onRetry={() => {
                if (selectedConversationId) {
                  void loadConversationDetail(
                    selectedConversationId,
                  );
                }
              }}
            />
          ) : conversationDetail ? (
            <ConversationThread
              conversation={
                conversationDetail
              }
              messages={messages}
              refreshing={
                refreshingDetail
              }
              onRefresh={() => {
                void Promise.all([
                  loadConversationDetail(
                    conversationDetail.id,
                    {
                      quiet: true,
                    },
                  ),
                  loadConversations({
                    quiet: true,
                  }),
                ]);
              }}
              onReply={(message) =>
                openMessageComposer(
                  "REPLY",
                  message,
                )
              }
              onReplyAll={(message) =>
                openMessageComposer(
                  "REPLY_ALL",
                  message,
                )
              }
              onForward={(message) =>
                openMessageComposer(
                  "FORWARD",
                  message,
                )
              }
              onDelete={() =>
                requestDeleteConversation(
                  conversationDetail.id,
                )
              }
              deleting={
                deletingConversation &&
                deleteConversationId ===
                  conversationDetail.id
              }
            />
          ) : selectedConversation ? (
            <ConversationDetailLoadingState />
          ) : (
            <ConversationDetailEmptyState />
          )}
        </div>
      </div>

      {deleteConversationId ? (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/85 p-5 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-conversation-title"
        >
          <div className="w-full max-w-lg rounded-[2rem] border border-rose-400/20 bg-[#07111f] p-6 shadow-2xl shadow-black/60">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-rose-300">
              Permanent deletion
            </p>

            <h3
              id="delete-conversation-title"
              className="mt-3 text-2xl font-semibold text-white"
            >
              Delete conversation?
            </h3>

            <p className="mt-4 text-sm leading-6 text-slate-300">
              This permanently removes the conversation and its associated communication records from Truvern. This action cannot be undone.
            </p>

            {conversationDetail?.id ===
            deleteConversationId ? (
              <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                  Conversation
                </p>

                <p className="mt-2 font-semibold text-white">
                  {conversationDetail.subject}
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  Conversation #{conversationDetail.id}
                </p>
              </div>
            ) : null}

            {deleteConversationError ? (
              <div className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-500/10 p-4">
                <p className="text-sm text-rose-100">
                  {deleteConversationError}
                </p>
              </div>
            ) : null}

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={cancelDeleteConversation}
                disabled={deletingConversation}
                className="rounded-full border border-white/15 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() =>
                  void deleteConversation()
                }
                disabled={deletingConversation}
                className="rounded-full border border-rose-300/30 bg-rose-500/15 px-5 py-2.5 text-sm font-semibold text-rose-100 transition hover:bg-rose-500/25 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {deletingConversation
                  ? "Deleting..."
                  : "Delete permanently"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {composerOpen ? (
        <CommunicationComposer
          mailboxes={mailboxes}
          mailboxId={composerMailboxId}
          to={composerTo}
          cc={composerCc}
          bcc={composerBcc}
          replyTo={composerReplyTo}
          subject={composerSubject}
          message={composerMessage}
          priority={composerPriority}
          sending={sendingMessage}
          error={composerError}
          onMailboxChange={
            setComposerMailboxId
          }
          onToChange={setComposerTo}
          onCcChange={setComposerCc}
          onBccChange={setComposerBcc}
          onReplyToChange={
            setComposerReplyTo
          }
          onSubjectChange={
            setComposerSubject
          }
          onMessageChange={
            setComposerMessage
          }
          onPriorityChange={
            setComposerPriority
          }
          onClose={closeComposer}
          onSubmit={
            sendComposedMessage
          }
        />
      ) : null}
    </section>
  );
}

function CommunicationComposer({
  mailboxes,
  mailboxId,
  to,
  cc,
  bcc,
  replyTo,
  subject,
  message,
  priority,
  sending,
  error,
  onMailboxChange,
  onToChange,
  onCcChange,
  onBccChange,
  onReplyToChange,
  onSubjectChange,
  onMessageChange,
  onPriorityChange,
  onClose,
  onSubmit,
}: {
  mailboxes: Mailbox[];
  mailboxId: number | null;
  to: string;
  cc: string;
  bcc: string;
  replyTo: string;
  subject: string;
  message: string;
  priority: string;
  sending: boolean;
  error: string | null;

  onMailboxChange: (
    value: number | null,
  ) => void;

  onToChange: (
    value: string,
  ) => void;

  onCcChange: (
    value: string,
  ) => void;

  onBccChange: (
    value: string,
  ) => void;

  onReplyToChange: (
    value: string,
  ) => void;

  onSubjectChange: (
    value: string,
  ) => void;

  onMessageChange: (
    value: string,
  ) => void;

  onPriorityChange: (
    value: string,
  ) => void;

  onClose: () => void;

  onSubmit: (
    event:
      React.FormEvent<HTMLFormElement>,
  ) => void;
}) {
  const activeMailboxes =
    mailboxes.filter(
      (mailbox) =>
        mailbox.isActive,
    );

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/80 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="communication-composer-title"
    >
      <button
        type="button"
        aria-label="Close composer"
        onClick={onClose}
        disabled={sending}
        className="absolute inset-0 cursor-default"
      />

      <form
        onSubmit={onSubmit}
        className="relative z-10 flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-t-[2rem] border border-white/10 bg-[#07111f] shadow-2xl shadow-black/60 sm:rounded-[2rem]"
      >
        <div className="flex items-start justify-between gap-4 border-b border-white/10 p-5 sm:p-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200">
              Outbound communication
            </p>

            <h3
              id="communication-composer-title"
              className="mt-2 text-2xl font-semibold text-white"
            >
              New message
            </h3>

            <p className="mt-2 text-sm text-slate-400">
              Send a tenant-scoped message through an active Truvern mailbox.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={sending}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 text-xl text-slate-300 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Close composer"
          >
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 6l12 12M18 6 6 18"
              />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto p-5 sm:p-6">
          {error ? (
            <div className="mb-5 rounded-2xl border border-rose-400/20 bg-rose-500/10 p-4">
              <p className="text-sm font-semibold text-rose-100">
                Message could not be sent
              </p>

              <p className="mt-1 text-sm text-rose-200/80">
                {error}
              </p>
            </div>
          ) : null}

          <div className="grid gap-5">
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                From mailbox
              </span>

              <select
                value={
                  mailboxId ??
                  ""
                }
                onChange={(event) => {
                  const nextValue =
                    Number(
                      event.target.value,
                    );

                  onMailboxChange(
                    Number.isInteger(
                      nextValue,
                    ) &&
                    nextValue > 0
                      ? nextValue
                      : null,
                  );
                }}
                disabled={sending}
                className="mt-2 min-h-12 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 text-sm text-white outline-none transition focus:border-cyan-400/50 disabled:cursor-not-allowed disabled:opacity-60"
                required
              >
                <option value="">
                  Select mailbox
                </option>

                {activeMailboxes.map(
                  (mailbox) => (
                    <option
                      key={mailbox.id}
                      value={mailbox.id}
                    >
                      {mailbox.name}
                      {" - "}
                      {mailbox.address}
                      {mailbox.isDefault ? " - Default" : ""}
                    </option>
                  ),
                )}
              </select>
            </label>

            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                To
              </span>

              <input
                value={to}
                onChange={(event) =>
                  onToChange(
                    event.target.value,
                  )
                }
                disabled={sending}
                placeholder="vendor@example.com, assessor@example.com"
                className="mt-2 min-h-12 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-400/50 disabled:cursor-not-allowed disabled:opacity-60"
                required
                autoFocus
              />

              <span className="mt-2 block text-xs leading-5 text-slate-500">
                Separate multiple recipients with commas or semicolons.
              </span>
            </label>

            <div className="grid gap-5 lg:grid-cols-2">
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  CC
                </span>

                <input
                  value={cc}
                  onChange={(event) =>
                    onCcChange(
                      event.target.value,
                    )
                  }
                  disabled={sending}
                  placeholder="Optional copy recipients"
                  className="mt-2 min-h-12 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-400/50 disabled:cursor-not-allowed disabled:opacity-60"
                />
              </label>

              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  BCC
                </span>

                <input
                  value={bcc}
                  onChange={(event) =>
                    onBccChange(
                      event.target.value,
                    )
                  }
                  disabled={sending}
                  placeholder="Optional blind-copy recipients"
                  className="mt-2 min-h-12 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-400/50 disabled:cursor-not-allowed disabled:opacity-60"
                />
              </label>
            </div>

            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_180px]">
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Reply-To
                </span>

                <input
                  type="email"
                  value={replyTo}
                  onChange={(event) =>
                    onReplyToChange(
                      event.target.value,
                    )
                  }
                  disabled={sending}
                  placeholder="reply@example.com"
                  className="mt-2 min-h-12 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-400/50 disabled:cursor-not-allowed disabled:opacity-60"
                />
              </label>

              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Priority
                </span>

                <select
                  value={priority}
                  onChange={(event) =>
                    onPriorityChange(
                      event.target.value,
                    )
                  }
                  disabled={sending}
                  className="mt-2 min-h-12 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 text-sm text-white outline-none transition focus:border-cyan-400/50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <option value="LOW">
                    Low
                  </option>

                  <option value="NORMAL">
                    Normal
                  </option>

                  <option value="HIGH">
                    High
                  </option>

                  <option value="URGENT">
                    Urgent
                  </option>
                </select>
              </label>
            </div>

            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                Subject
              </span>

              <input
                value={subject}
                onChange={(event) =>
                  onSubjectChange(
                    event.target.value,
                  )
                }
                disabled={sending}
                maxLength={500}
                placeholder="Enter message subject"
                className="mt-2 min-h-12 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-400/50 disabled:cursor-not-allowed disabled:opacity-60"
                required
              />
            </label>

            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                Message
              </span>

              <textarea
                value={message}
                onChange={(event) =>
                  onMessageChange(
                    event.target.value,
                  )
                }
                disabled={sending}
                rows={12}
                placeholder="Write your message..."
                className="mt-2 min-h-[260px] w-full resize-y rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-4 text-sm leading-7 text-white outline-none placeholder:text-slate-500 focus:border-cyan-400/50 disabled:cursor-not-allowed disabled:opacity-60"
                required
              />
            </label>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-white/10 bg-slate-950/30 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <p className="text-xs leading-5 text-slate-500">
            Recipient validation and cross-field deduplication occur before delivery.
          </p>

          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={sending}
              className="min-h-11 rounded-full border border-white/15 px-5 text-sm font-semibold text-slate-200 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={sending}
              className="inline-flex min-h-11 min-w-32 items-center justify-center rounded-full bg-cyan-300 px-6 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {sending
                ? "Sending..."
                : "Send message"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

function ConversationThread({
  conversation,
  messages,
  refreshing,
  onRefresh,
  onReply,
  onReplyAll,
  onForward,
  onDelete,
  deleting,
}: {
  conversation: ConversationDetail;
  messages: ConversationMessage[];
  refreshing: boolean;
  onRefresh: () => void;
  onReply: (
    message: ConversationMessage,
  ) => void;
  onReplyAll: (
    message: ConversationMessage,
  ) => void;
  onForward: (
    message: ConversationMessage,
  ) => void;

  onDelete: () => void;
  deleting: boolean;
}) {
  return (
    <div className="flex min-h-[680px] flex-col">
      <div className="border-b border-white/10 p-5 sm:p-7">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap gap-2">
              <span
                className={[
                  "rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]",
                  statusTone(
                    conversation.status,
                  ),
                ].join(" ")}
              >
                {conversation.status}
              </span>

              <span
                className={[
                  "rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]",
                  priorityTone(
                    conversation.priority,
                  ),
                ].join(" ")}
              >
                {conversation.priority}
              </span>

              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-slate-300">
                {conversation.channel}
              </span>
            </div>

            <h3 className="mt-4 break-words text-2xl font-semibold text-white sm:text-3xl">
              {conversation.subject}
            </h3>

            <p className="mt-3 text-sm text-slate-400">
              Conversation #{conversation.id}
              {" - "}
              Last activity {formatDate(
                conversation.lastMessageAt,
              )}
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onRefresh}
              disabled={
                refreshing ||
                deleting
              }
              className="inline-flex min-h-10 items-center justify-center rounded-full border border-white/15 px-4 py-2 text-xs font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {refreshing
                ? "Refreshing..."
                : "Refresh thread"}
            </button>

            <button
              type="button"
              onClick={onDelete}
              disabled={
                refreshing ||
                deleting
              }
              className="inline-flex min-h-10 items-center justify-center rounded-full border border-rose-400/25 bg-rose-500/[0.08] px-4 py-2 text-xs font-semibold text-rose-200 transition hover:bg-rose-500/15 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {deleting
                ? "Deleting..."
                : "Delete conversation"}
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <DetailMetric
            label="Messages"
            value={conversation.counts.total}
          />

          <DetailMetric
            label="Inbound"
            value={conversation.counts.inbound}
          />

          <DetailMetric
            label="Outbound"
            value={conversation.counts.outbound}
          />

          <DetailMetric
            label="Failed"
            value={conversation.counts.failed}
            attention={
              conversation.counts.failed > 0
            }
          />
        </div>
      </div>

      <GovernanceContextCard
        conversation={conversation}
      />

      <div className="flex-1 bg-slate-950/20 p-4 sm:p-6">
        {messages.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-white/15 bg-white/[0.025] p-8 text-center">
            <h4 className="text-lg font-semibold text-white">
              No messages in this conversation
            </h4>

            <p className="mt-2 text-sm leading-6 text-slate-400">
              The conversation exists, but no communication messages have been
              recorded yet.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {messages.map(
              (message) => (
                <MessageCard
                  key={message.id}
                  message={message}
                  onReply={onReply}
                  onReplyAll={onReplyAll}
                  onForward={onForward}
                />
              ),
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function GovernanceContextCard({
  conversation,
}: {
  conversation: ConversationDetail;
}) {
  const records =
    conversation.linkedRecords;

  const hasLinkedRecord =
    Boolean(
      records.vendor ||
      records.assessment ||
      records.assessmentRun ||
      records.reviewRequest ||
      records.reviewAssignment,
    );

  return (
    <div className="border-b border-white/10 bg-cyan-400/[0.025] p-5 sm:p-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200">
            Governance context
          </p>

          <h4 className="mt-2 text-lg font-semibold text-white">
            Linked Truvern workflow records
          </h4>
        </div>

        <div className="rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm">
          <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">
            Mailbox
          </p>

          <p className="mt-1 font-semibold text-white">
            {conversation.mailbox.name}
          </p>

          <p className="mt-1 text-xs text-slate-400">
            {conversation.mailbox.address}
          </p>
        </div>
      </div>

      {hasLinkedRecord ? (
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {records.vendor ? (
            <ContextLink
              label="Vendor"
              value={
                records.vendor.name ||
                `Vendor #${records.vendor.id}`
              }
              href={`/vendors/${records.vendor.id}`}
            />
          ) : null}

          {records.assessment ? (
            <ContextLink
              label="Assessment"
              value={
                records.assessment.name ||
                `Assessment #${records.assessment.id}`
              }
              detail={
                records.assessment.status ||
                undefined
              }
              href={`/assessments/${records.assessment.id}`}
            />
          ) : null}

          {records.assessmentRun ? (
            <ContextValue
              label="Assessment run"
              value={`#${records.assessmentRun.id}`}
              detail={
                records.assessmentRun.status ||
                undefined
              }
            />
          ) : null}

          {records.reviewRequest ? (
            <ContextValue
              label="Review request"
              value={`#${records.reviewRequest.id}`}
              detail={
                records.reviewRequest.status ||
                undefined
              }
            />
          ) : null}

          {records.reviewAssignment ? (
            <ContextLink
              label="Review assignment"
              value={`#${records.reviewAssignment.id}`}
              detail={[
                records.reviewAssignment.status,
                records.reviewAssignment.reviewer,
              ]
                .filter(Boolean)
                .join(" ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â· ") || undefined}
              href={`/review-desk/${records.reviewAssignment.id}`}
            />
          ) : null}

          {conversation.externalThreadId ? (
            <ContextValue
              label="External thread"
              value={
                conversation.externalThreadId
              }
            />
          ) : null}
        </div>
      ) : (
        <div className="mt-5 rounded-2xl border border-dashed border-white/10 bg-slate-950/30 p-4 text-sm text-slate-400">
          This conversation is not yet linked to a vendor, assessment, or review.
        </div>
      )}
    </div>
  );
}

function MessageCard({
  message,
  onReply,
  onReplyAll,
  onForward,
}: {
  message: ConversationMessage;
  onReply: (
    message: ConversationMessage,
  ) => void;
  onReplyAll: (
    message: ConversationMessage,
  ) => void;
  onForward: (
    message: ConversationMessage,
  ) => void;
}) {
  const tone =
    directionTone(
      message.direction,
    );

  const sender =
    message.from.name ||
    message.from.address ||
    (
      message.direction.toUpperCase() ===
      "OUTBOUND"
        ? "Truvern"
        : "Unknown sender"
    );

  return (
    <article
      className={[
        "w-full max-w-4xl rounded-3xl border p-5 shadow-xl shadow-black/10 sm:p-6",
        tone.border,
        tone.background,
        tone.alignment,
      ].join(" ")}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={[
                "rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]",
                tone.badge,
              ].join(" ")}
            >
              {message.direction}
            </span>

            <span
              className={[
                "rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]",
                statusTone(
                  message.status,
                ),
              ].join(" ")}
            >
              {message.status}
            </span>

            <span className="rounded-full border border-white/10 bg-slate-950/40 px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-slate-400">
              {message.channel}
            </span>
          </div>

          <h5 className="mt-4 break-words text-base font-semibold text-white">
            {message.subject ||
             "Message"}
          </h5>

          <p className="mt-2 break-words text-sm text-slate-300">
            {sender}
          </p>

          {message.from.address &&
          message.from.address !== sender ? (
            <p className="mt-1 break-all text-xs text-slate-500">
              {message.from.address}
            </p>
          ) : null}
        </div>

        <time className="shrink-0 text-xs text-slate-500">
          {formatDate(
            message.activityAt,
          )}
        </time>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-white/10 pt-4">
        <button
          type="button"
          onClick={() =>
            onReply(message)
          }
          className="inline-flex min-h-9 items-center justify-center rounded-full border border-cyan-400/25 bg-cyan-400/[0.07] px-4 text-xs font-semibold text-cyan-100 transition hover:border-cyan-300/40 hover:bg-cyan-400/[0.13]"
        >
          Reply
        </button>

        <button
          type="button"
          onClick={() =>
            onReplyAll(message)
          }
          className="inline-flex min-h-9 items-center justify-center rounded-full border border-white/15 bg-white/[0.04] px-4 text-xs font-semibold text-slate-200 transition hover:bg-white/[0.09] hover:text-white"
        >
          Reply all
        </button>

        <button
          type="button"
          onClick={() =>
            onForward(message)
          }
          className="inline-flex min-h-9 items-center justify-center rounded-full border border-white/15 bg-white/[0.04] px-4 text-xs font-semibold text-slate-200 transition hover:bg-white/[0.09] hover:text-white"
        >
          Forward
        </button>
      </div>

      <div className="mt-5 rounded-2xl border border-white/10 bg-slate-950/30 p-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
          Recipient details
        </p>

        <dl className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="min-w-0">
            <dt className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              To
            </dt>

            <dd className="mt-1 break-all text-xs leading-5 text-slate-300">
              {recipientDisplay(
                message,
                "TO",
              )}
            </dd>
          </div>

          <div className="min-w-0">
            <dt className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              CC
            </dt>

            <dd className="mt-1 break-all text-xs leading-5 text-slate-300">
              {recipientDisplay(
                message,
                "CC",
              )}
            </dd>
          </div>
        </dl>

        <p className="mt-3 text-[11px] leading-5 text-slate-500">
          Blind-copy recipients are protected and are not returned to this interface.
        </p>
      </div>

      <div className="mt-5 whitespace-pre-wrap break-words rounded-2xl border border-white/10 bg-slate-950/35 p-4 text-sm leading-7 text-slate-200">
        {messageBody(message)}
      </div>

      <DeliveryTimeline
        message={message}
      />

      <details className="mt-5 rounded-2xl border border-white/10 bg-slate-950/30">
        <summary className="cursor-pointer px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
          Technical message details
        </summary>

        <div className="grid gap-3 border-t border-white/10 p-4 sm:grid-cols-2">
          <TechnicalRow
            label="Message ID"
            value={`#${message.id}`}
          />

          <TechnicalRow
            label="Provider"
            value={
              message.threading.provider ||
              "Not recorded"
            }
          />

          <TechnicalRow
            label="Provider message ID"
            value={
              message.threading.providerMessageId ||
              "Not recorded"
            }
          />

          <TechnicalRow
            label="Internet message ID"
            value={
              message.threading.internetMessageId ||
              "Not recorded"
            }
          />

          <TechnicalRow
            label="In reply to"
            value={
              message.threading.inReplyToMessageId ||
              "Not recorded"
            }
          />

          <TechnicalRow
            label="To"
            value={
              recipientDisplay(
                message,
                "TO",
              )
            }
          />

          <TechnicalRow
            label="CC"
            value={
              recipientDisplay(
                message,
                "CC",
              )
            }
          />

          <TechnicalRow
            label="Reply-to address"
            value={
              message.replyToAddress ||
              "Not recorded"
            }
          />
        </div>
      </details>

      {message.delivery.error ? (
        <div className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-500/10 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-200">
            Delivery error
          </p>

          <p className="mt-2 text-sm text-rose-100">
            {message.delivery.error.message ||
             "The message failed without a recorded error description."}
          </p>

          {message.delivery.error.code ? (
            <p className="mt-2 text-xs text-rose-200/70">
              Code: {message.delivery.error.code}
            </p>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function DeliveryTimeline({
  message,
}: {
  message: ConversationMessage;
}) {
  const events = [
    {
      label: "Queued",
      value:
        message.delivery.queuedAt,
    },
    {
      label: "Sent",
      value:
        message.delivery.sentAt,
    },
    {
      label: "Delivered",
      value:
        message.delivery.deliveredAt,
    },
    {
      label: "Received",
      value:
        message.delivery.receivedAt,
    },
    {
      label: "Failed",
      value:
        message.delivery.failedAt,
    },
  ].filter(
    (
      event,
    ): event is {
      label: string;
      value: string;
    } => Boolean(event.value),
  );

  if (events.length === 0) {
    return null;
  }

  return (
    <div className="mt-5 border-t border-white/10 pt-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
        Delivery timeline
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {events.map(
          (event) => (
            <div
              key={`${event.label}-${event.value}`}
              className={[
                "rounded-2xl border px-3 py-2",
                event.label === "Failed"
                  ? "border-rose-400/20 bg-rose-500/10"
                  : "border-white/10 bg-slate-950/40",
              ].join(" ")}
            >
              <p
                className={[
                  "text-[10px] font-semibold uppercase tracking-[0.16em]",
                  event.label === "Failed"
                    ? "text-rose-200"
                    : "text-slate-500",
                ].join(" ")}
              >
                {event.label}
              </p>

              <p className="mt-1 text-xs text-slate-300">
                {formatDate(
                  event.value,
                )}
              </p>
            </div>
          ),
        )}
      </div>
    </div>
  );
}

function DetailMetric({
  label,
  value,
  attention = false,
}: {
  label: string;
  value: number;
  attention?: boolean;
}) {
  return (
    <div
      className={[
        "rounded-2xl border p-4",
        attention
          ? "border-rose-400/20 bg-rose-400/[0.06]"
          : "border-white/10 bg-white/[0.03]",
      ].join(" ")}
    >
      <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
        {label}
      </p>

      <p
        className={[
          "mt-2 text-2xl font-semibold",
          attention
            ? "text-rose-200"
            : "text-white",
        ].join(" ")}
      >
        {value}
      </p>
    </div>
  );
}

function ContextLink({
  label,
  value,
  detail,
  href,
}: {
  label: string;
  value: string;
  detail?: string;
  href: string;
}) {
  return (
    <a
      href={href}
      className="rounded-2xl border border-white/10 bg-slate-950/45 p-4 transition hover:border-cyan-400/30 hover:bg-cyan-400/[0.06]"
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
        {label}
      </p>

      <p className="mt-2 break-words text-sm font-semibold text-white">
        {value}
      </p>

      {detail ? (
        <p className="mt-1 break-words text-xs text-slate-400">
          {detail}
        </p>
      ) : null}
    </a>
  );
}

function ContextValue({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
        {label}
      </p>

      <p className="mt-2 break-words text-sm font-semibold text-white">
        {value}
      </p>

      {detail ? (
        <p className="mt-1 break-words text-xs text-slate-400">
          {detail}
        </p>
      ) : null}
    </div>
  );
}

function TechnicalRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        {label}
      </p>

      <p className="mt-1 break-all text-xs leading-5 text-slate-300">
        {value}
      </p>
    </div>
  );
}

function ConversationLoadingState() {
  return (
    <div className="space-y-3 p-4">
      {Array.from({
        length: 6,
      }).map((_, index) => (
        <div
          key={index}
          className="animate-pulse rounded-2xl border border-white/10 bg-white/[0.025] p-4"
        >
          <div className="h-4 w-2/3 rounded bg-white/10" />
          <div className="mt-3 h-3 w-1/3 rounded bg-white/[0.07]" />
          <div className="mt-4 h-3 w-full rounded bg-white/[0.06]" />
          <div className="mt-2 h-3 w-4/5 rounded bg-white/[0.06]" />
        </div>
      ))}
    </div>
  );
}

function ConversationDetailLoadingState() {
  return (
    <div className="animate-pulse p-6 sm:p-8">
      <div className="h-5 w-32 rounded bg-white/10" />
      <div className="mt-5 h-8 w-2/3 rounded bg-white/10" />

      <div className="mt-7 grid gap-3 sm:grid-cols-4">
        {Array.from({
          length: 4,
        }).map((_, index) => (
          <div
            key={index}
            className="h-24 rounded-2xl bg-white/[0.05]"
          />
        ))}
      </div>

      <div className="mt-8 space-y-5">
        {Array.from({
          length: 3,
        }).map((_, index) => (
          <div
            key={index}
            className="h-52 rounded-3xl border border-white/10 bg-white/[0.035]"
          />
        ))}
      </div>
    </div>
  );
}

function ConversationEmptyState({
  hasSearch,
  hasMailboxes,
}: {
  hasSearch: boolean;
  hasMailboxes: boolean;
}) {
  return (
    <div className="p-6">
      <div className="rounded-3xl border border-dashed border-white/15 bg-white/[0.025] p-7 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-400/10 text-xl text-cyan-200">&#9993;</div>

        <h3 className="mt-5 text-lg font-semibold text-white">
          {!hasMailboxes
            ? "No communication mailbox yet"
            : hasSearch
              ? "No matching conversations"
              : "No conversations yet"}
        </h3>

        <p className="mt-2 text-sm leading-6 text-slate-400">
          {!hasMailboxes
            ? "A mailbox will appear after Truvern creates or resolves the first organization communication channel."
            : hasSearch
              ? "Clear the search or try a different subject, sender, or message term."
              : "Messages sent through the communications engine will appear here automatically."}
        </p>
      </div>
    </div>
  );
}

function ConversationDetailEmptyState() {
  return (
    <div className="flex min-h-[500px] items-center justify-center p-6">
      <div className="max-w-lg text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-2xl text-slate-300">&#8599;</div>

        <h3 className="mt-5 text-xl font-semibold text-white">
          Select a conversation
        </h3>

        <p className="mt-3 text-sm leading-7 text-slate-400">
          Choose a conversation from the inbox to inspect its complete message
          history, delivery status, sender metadata, and linked governance
          records.
        </p>
      </div>
    </div>
  );
}

function ConversationDetailErrorState({
  error,
  onRetry,
}: {
  error: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex min-h-[500px] items-center justify-center p-6">
      <div className="w-full max-w-lg rounded-3xl border border-rose-400/20 bg-rose-500/10 p-7 text-center">
        <h3 className="text-xl font-semibold text-rose-100">
          Conversation could not be loaded
        </h3>

        <p className="mt-3 text-sm leading-7 text-rose-200/80">
          {error}
        </p>

        <button
          type="button"
          onClick={onRetry}
          className="mt-6 rounded-full border border-rose-300/30 bg-rose-300/10 px-5 py-2.5 text-sm font-semibold text-rose-100 transition hover:bg-rose-300/20"
        >
          Retry
        </button>
      </div>
    </div>
  );
}
