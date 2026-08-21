import "server-only";

export type CommunicationEntityLinks = {
  organizationId?: number | null;
  vendorId?: number | null;
  assessmentId?: number | null;
  assessmentRunId?: number | null;
  reviewRequestId?: number | null;
  reviewAssignmentId?: number | null;
  evidenceRequestId?: number | null;
};

export type CommunicationAddress = {
  address: string;
  displayName?: string | null;
};

export type OutboundCommunicationDraft =
  CommunicationEntityLinks & {
    mailboxKey: string;
    subject: string;
    textBody?: string | null;
    htmlBody?: string | null;
    to: CommunicationAddress[];
    cc?: CommunicationAddress[];
    bcc?: CommunicationAddress[];
    replyTo?: CommunicationAddress | null;
    scheduledFor?: Date | null;
    createdByUserId?: string | null;
    metadata?: Record<string, unknown>;
  };

export type CommunicationDirection =
  | "INBOUND"
  | "OUTBOUND"
  | "INTERNAL";

export type CommunicationChannel =
  | "EMAIL"
  | "PORTAL"
  | "SYSTEM";

export type CommunicationStatus =
  | "QUEUED"
  | "SENT"
  | "DELIVERED"
  | "RECEIVED"
  | "FAILED";

export type CommunicationPriority =
  | "LOW"
  | "NORMAL"
  | "HIGH"
  | "URGENT";

export type CommunicationTimelineEntry =
  CommunicationEntityLinks & {
    id: number;
    direction: CommunicationDirection;
    channel: CommunicationChannel;
    status: string;
    subject: string;
    occurredAt: Date;
    fromAddress: string;
    recipientAddresses: string[];
  };

export type MailboxIdentity = {
  id: number;
  organizationId: number;
  name: string;
  address: string;
};

export type ConversationReference = {
  id: number;
  organizationId: number;
  mailboxId: number;
  subject: string;
};

export type SendCommunicationInput = {
  organizationId: number;

  to: string;
  subject: string;
  html: string;

  text?: string;
  from?: string;

  cc?: string[];
  bcc?: string[];
  replyTo?: string;

  mailboxId?: number;
  mailboxKey?: string;
  mailboxName?: string;
  mailboxAddress?: string;

  conversationId?: number;

  /**
   * Internal Truvern CommunicationMessage identifier for the
   * message being replied to.
   *
   * This is not an RFC Internet Message-ID. The provider threading
   * stage resolves this internal ID into internetMessageId,
   * providerMessageId, In-Reply-To, and References metadata.
   */
  replyMessageId?: number;

  externalThreadId?: string;

  priority?: CommunicationPriority;
  channel?: CommunicationChannel;

  context?: CommunicationEntityLinks;
};

export type SendCommunicationResult = {
  ok: true;
  mailboxId: number;
  conversationId: number;
  messageId: number;
  provider: string;
  providerMessageId: string | null;
  simulated: boolean;
};
