import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createOrgNotification } from "@/lib/notifications/create-notification";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function json(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function daysUntil(dueAt: Date) {
  const today = startOfDay(new Date());
  const due = startOfDay(dueAt);
  return Math.round((due.getTime() - today.getTime()) / 86400000);
}

function reminderLabel(days: number) {
  if (days < 0) return "overdue";
  if (days === 0) return "due today";
  if (days === 1) return "due tomorrow";
  return `due in ${days} days`;
}

export async function GET(req: Request) {
  try {
  const secret = process.env.CRON_SECRET;
  const provided = req.headers.get("x-cron-secret") || new URL(req.url).searchParams.get("secret");

  if (secret && provided !== secret) {
    return json(401, { ok: false, error: "Unauthorized" });
  }

  const now = new Date();
  const horizon = addDays(now, 30);

  const vendors = await prisma.vendor.findMany({
    where: {
      nextReviewDueAt: {
        lte: horizon,
      },
    },
    select: {
      id: true,
      name: true,
      organizationId: true,
      nextReviewDueAt: true,
    },
    orderBy: [{ nextReviewDueAt: "asc" }, { id: "asc" }],
    take: 250,
  });

  let created = 0;
  let skipped = 0;

  for (const vendor of vendors) {
    if (!vendor.nextReviewDueAt) {
      skipped++;
      continue;
    }

    const days = daysUntil(vendor.nextReviewDueAt);

    const shouldNotify =
      days === 30 ||
      days === 14 ||
      days === 7 ||
      days === 1 ||
      days === 0 ||
      days < 0;

    if (!shouldNotify) {
      skipped++;
      continue;
    }

    const type = days < 0 ? "REASSESSMENT_OVERDUE" : "REASSESSMENT_DUE";
    const severity = days < 0 ? "CRITICAL" : days <= 7 ? "WARNING" : "INFO";
    const label = reminderLabel(days);
    const eventKey = `${type}:${vendor.id}:${startOfDay(vendor.nextReviewDueAt).toISOString()}`;

    const existing = await prisma.notification.findFirst({
      where: {
        organizationId: vendor.organizationId,
        type,
        metadataJson: {
          path: ["eventKey"],
          equals: eventKey,
        },
      },
      select: { id: true },
    });

    if (existing) {
      skipped++;
      continue;
    }

    await createOrgNotification({
      organizationId: vendor.organizationId,
      type,
      severity,
      title: `Vendor reassessment ${label} - ${vendor.name}`,
      message: "A vendor governance reassessment requires attention.",
      href: `/vendors/${vendor.id}`,
      metadataJson: {
        eventKey,
        vendorId: vendor.id,
        dueAt: vendor.nextReviewDueAt.toISOString(),
        daysUntilDue: days,
        source: "reassessment_reminder_cron",
      },
    });

    created++;
  }

  return json(200, {
    ok: true,
    checked: vendors.length,
    created,
    skipped,
  });
  } catch (error: any) {
    console.error("reassessment reminder cron failed", error);

    return json(500, {
      ok: false,
      error: String(error?.message || error),
    });
  }
}



