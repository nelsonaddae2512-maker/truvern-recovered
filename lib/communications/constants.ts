export const COMMUNICATION_MAILBOX_KEYS = {
  REVIEWS: "reviews",
  ASSESSMENTS: "assessments",
  SUPPORT: "support",
  SECURITY: "security",
  BILLING: "billing",
} as const;

export type CommunicationMailboxKey =
  (typeof COMMUNICATION_MAILBOX_KEYS)[keyof typeof COMMUNICATION_MAILBOX_KEYS];

export const COMMUNICATION_MAILBOX_ADDRESSES = {
  [COMMUNICATION_MAILBOX_KEYS.REVIEWS]: "reviews@truvern.com",
  [COMMUNICATION_MAILBOX_KEYS.ASSESSMENTS]: "assessments@truvern.com",
  [COMMUNICATION_MAILBOX_KEYS.SUPPORT]: "support@truvern.com",
  [COMMUNICATION_MAILBOX_KEYS.SECURITY]: "security@truvern.com",
  [COMMUNICATION_MAILBOX_KEYS.BILLING]: "billing@truvern.com",
} as const;

export const COMMUNICATION_SYSTEM_ACTOR = "TRUVERN_SYSTEM";

export const COMMUNICATION_DEFAULT_FROM =
  "Truvern Assessments <assessments@truvern.com>";
