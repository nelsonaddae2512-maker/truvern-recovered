import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";

export type FrameworkAssessmentAuditEvent = {
  id: number;
  actorUserId: string | null;
  entityType: string;
  entityId: string;
  action: string;
  message: string | null;
  metadata: unknown;
  createdAt: Date;
};

export async function readFrameworkAssessmentAuditEvents(
  assessmentId: number,
): Promise<FrameworkAssessmentAuditEvent[]> {
  return prisma.$queryRaw<FrameworkAssessmentAuditEvent[]>`
    select
      id,
      "actorUserId",
      "entityType",
      "entityId",
      action,
      message,
      metadata,
      "createdAt"
    from "AuditLog"
    where "entityType" = 'TruvernFrameworkAssessment'
      and "entityId" = ${String(assessmentId)}
    order by "createdAt" desc, id desc
    limit 50
  `;
}
export type FrameworkAssessmentAuditEventIdRow = {
  id: number;
};

export async function readFrameworkAssessmentAuditEventIds(
  assessmentId: number,
): Promise<FrameworkAssessmentAuditEventIdRow[]> {
  return prisma.$queryRaw<FrameworkAssessmentAuditEventIdRow[]>`
    select id
    from "AuditLog"
    where "entityType" = 'TruvernFrameworkAssessment'
      and "entityId" = ${String(assessmentId)}
  `;
}
export type FrameworkAssessmentAuditTimelineRow = {
  id: number;
  actorUserId: string | null;
  action: string;
  message: string | null;
  metadata: unknown;
  createdAt: Date;
};

export async function readFrameworkAssessmentAuditTimeline(
  assessmentId: number,
): Promise<FrameworkAssessmentAuditTimelineRow[]> {
  return prisma.$queryRaw<FrameworkAssessmentAuditTimelineRow[]>`
    select
      id,
      "actorUserId",
      action,
      message,
      metadata,
      "createdAt"
    from "AuditLog"
    where "entityType" = 'TruvernFrameworkAssessment'
      and "entityId" = ${String(assessmentId)}
    order by "createdAt" asc, id asc
    limit 100
  `;
}

export async function countFrameworkAssessmentAuditLogs(
  assessmentId: number,
  action: string,
): Promise<number> {
  return prisma.auditLog.count({
    where: {
      entityType: "TruvernFrameworkAssessment",
      entityId: String(assessmentId),
      action,
    },
  });
}
type FrameworkAssessmentAuditLogClient = Pick<
  Prisma.TransactionClient,
  "auditLog"
>;

export async function findFrameworkAssessmentAuditLogs<
  T extends Prisma.AuditLogFindManyArgs,
>(
  args: Prisma.SelectSubset<T, Prisma.AuditLogFindManyArgs>,
  client: FrameworkAssessmentAuditLogClient = prisma,
): Promise<Prisma.AuditLogGetPayload<T>[]> {
  return client.auditLog.findMany(args);
}
