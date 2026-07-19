import prisma from "@/lib/prisma";

type CreateEventInput = {
  organizationId: number;
  vendorId?: number | null;
  type: string;
  title: string;
  description?: string | null;
  metadata?: any;
  actor?: {
    userId?: number | null;
    name?: string | null;
    email?: string | null;
  } | null;
};

export async function logActivityEvent(input: CreateEventInput) {
  const orgId = Number(input.organizationId);
  if (!Number.isFinite(orgId) || orgId <= 0) return;

  const vendorId = input.vendorId == null ? null : Number(input.vendorId);

  const type = String(input.type || "").trim();
  const title = String(input.title || "").trim();
  if (!type || !title) return;

  try {
    await prisma.activityEvent.create({
      data: {
        organizationId: orgId,
        vendorId: vendorId && Number.isFinite(vendorId) ? vendorId : null,
        type,
        title,
        description: input.description ?? null,
        metadata: input.metadata ?? undefined,
        actorUserId: input.actor?.userId != null ? String(input.actor.userId) : null,
        actorName: input.actor?.name ?? null,
        actorEmail: input.actor?.email ?? null,
      },
    });
  } catch (e) {
    console.error("logActivityEvent failed:", e);
  }
}


