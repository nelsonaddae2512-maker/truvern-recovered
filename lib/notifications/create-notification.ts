import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";

export type NotificationType =
  | "VENDOR_SUBMITTED"
  | "REVIEW_ASSIGNED"
  | "TRUVERN_RELEASE_READY"
  | "TRUVERN_RELEASED"
  | "RELEASE_CONFIRMATION_REQUIRED"
  | "REASSESSMENT_DUE"
  | "REASSESSMENT_OVERDUE"
  | "LOW_CREDITS"
  | "CREDITS_GRANTED"
  | "PLAN_OVERRIDE_APPLIED"
  | "PLAN_OVERRIDE_EXPIRING"
  | "GOVERNANCE_SEAL_VERIFIED";

export type NotificationSeverity =
  | "INFO"
  | "SUCCESS"
  | "WARNING"
  | "CRITICAL";

export type CreateNotificationInput = {
  userId?: string | null;
  organizationId?: number | null;
  type: NotificationType;
  severity?: NotificationSeverity;
  title: string;
  message?: string | null;
  href?: string | null;
  metadataJson?: Prisma.InputJsonValue | null;
};

export async function createNotification(input: CreateNotificationInput) {
  return prisma.notification.create({
    data: {
      userId: input.userId ?? null,
      organizationId: input.organizationId ?? null,
      type: input.type,
      severity: input.severity ?? "INFO",
      title: input.title,
      message: input.message ?? null,
      href: input.href ?? null,
      metadataJson: input.metadataJson ?? undefined,
    },
  });
}

export async function createOrgNotification(input: Omit<CreateNotificationInput, "userId">) {
  return createNotification({
    ...input,
    userId: null,
  });
}


