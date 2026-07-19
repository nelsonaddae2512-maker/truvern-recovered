import prisma from "@/lib/prisma";

type ActivityCursor = {
  id: number;
  createdAt: string;
};

export function encodeCursor(c: ActivityCursor) {
  return Buffer.from(JSON.stringify(c), "utf8").toString("base64url");
}

export function decodeCursor(raw?: string | null): ActivityCursor | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(
      Buffer.from(raw, "base64url").toString("utf8"),
    );

    const id = Number(parsed?.id);
    const createdAt = String(parsed?.createdAt ?? "");

    if (!Number.isFinite(id) || !createdAt) return null;

    return { id, createdAt };
  } catch {
    return null;
  }
}

export async function fetchActivityEvents(opts: {
  organizationId: number;
  vendorId?: number | null;
  take: number;
  cursor?: ActivityCursor | null;
}) {
  const take = Math.max(1, Math.min(Number(opts.take || 25), 100));
  const cursor = opts.cursor ?? null;

  const where: any = {
    organizationId: opts.organizationId,
  };

  if (opts.vendorId != null) {
    where.vendorId = opts.vendorId;
  }

  if (cursor) {
    where.OR = [
      {
        createdAt: {
          lt: new Date(cursor.createdAt),
        },
      },
      {
        createdAt: new Date(cursor.createdAt),
        id: {
          lt: cursor.id,
        },
      },
    ];
  }

  const rows = await (prisma as any).activityEvent.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: take + 1,
  });

  const page = rows.slice(0, take);
  const next = rows.length > take ? rows[take] : null;

  return {
    items: page.map((r: any) => ({
      ...r,
      createdAt: r.createdAt?.toISOString?.() ?? String(r.createdAt ?? ""),
    })),
    nextCursor: next
      ? encodeCursor({
          id: Number(next.id),
          createdAt:
            next.createdAt?.toISOString?.() ?? String(next.createdAt ?? ""),
        })
      : null,
  };
}

