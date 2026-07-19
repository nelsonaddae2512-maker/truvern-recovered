import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import Stripe from "stripe";

import prisma from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function safeInt(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

async function insertCreditPurchaseLedgerEntry(input: {
  organizationId: number;
  userId: string;
  credits: number;
  stripeSessionId: string;
  stripePaymentIntentId?: string;
  packKey?: string;
  packName?: string;
}) {
  const eventKey = `stripe:checkout:${input.stripeSessionId}`;

  const existingRows = await prisma.$queryRawUnsafe<Array<{ count: number }>>(
    `
    select count(*)::int as count
    from "TruvernCreditLedgerEntry"
    where "eventKey" = $1
    `,
    eventKey,
  );

  if ((existingRows?.[0]?.count ?? 0) > 0) {
    return {
      ok: true,
      duplicate: true,
      eventKey,
    };
  }

  await prisma.$executeRawUnsafe(
    `
    insert into "TruvernCreditLedgerEntry" (
      "organizationId",
      "assessmentRunId",
      "reviewAssignmentId",
      "actorUserId",
      "eventKey",
      "entryType",
      "fundingSource",
      status,
      "availableDelta",
      "reservedDelta",
      "consumedDelta",
      quantity,
      currency,
      "unitPriceCents",
      "amountCents",
      note,
      "metadataJson",
      "createdAt"
    )
    values (
      $1,
      null,
      null,
      $2,
      $3,
      'PURCHASE'::"TruvernCreditEntryType",
      'PREPAID_CREDITS'::"TruvernCreditFundingSource",
      'POSTED'::text,
      $4,
      0,
      0,
      $5,
      null,
      null,
      null,
      $6,
      $7::jsonb,
      now()
    )
    `,
    input.organizationId,
    input.userId,
    eventKey,
    input.credits,
    input.credits,
    `Purchased ${input.credits} Truvern credit${input.credits === 1 ? "" : "s"} via Stripe Checkout.`,
    JSON.stringify({
      source: "stripe_checkout",
      stripeSessionId: input.stripeSessionId,
      stripePaymentIntentId: input.stripePaymentIntentId || null,
      credits: input.credits,
      packKey: input.packKey || null,
      packName: input.packName || null,
    }),
  );

  return {
    ok: true,
    inserted: true,
    eventKey,
  };
}

export async function POST(req: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    return NextResponse.json(
      {
        ok: false,
        error: "STRIPE_WEBHOOK_SECRET is not configured.",
      },
      { status: 503 },
    );
  }

  if (!stripe) {
    return NextResponse.json(
      {
        ok: false,
        error: "Stripe is unavailable.",
      },
      { status: 503 },
    );
  }

  const body = await req.text();
  const headerStore = await headers();
  const signature = headerStore.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      {
        ok: false,
        error: "Missing Stripe signature.",
      },
      { status: 400 },
    );
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Invalid Stripe webhook signature.",
      },
      { status: 400 },
    );
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const metadata = session.metadata || {};

        const organizationId = safeInt(
          metadata.organizationId || metadata.orgId,
          0,
        );

        const userId = String(metadata.userId || "").trim();
        const credits = safeInt(metadata.credits, 0);

        if (!organizationId || !userId || credits <= 0) {
          return NextResponse.json({
            ok: true,
            skipped: true,
            reason: "Missing required metadata.",
          });
        }

        const ledgerResult = await insertCreditPurchaseLedgerEntry({
          organizationId,
          userId,
          credits,
          stripeSessionId: session.id,
          stripePaymentIntentId:
            typeof session.payment_intent === "string"
              ? session.payment_intent
              : undefined,
          packKey: metadata.packKey,
          packName: metadata.packName,
        });

        if (!ledgerResult.duplicate) {
          revalidatePath("/billing/credits");
          revalidatePath("/review-desk");
        }

        break;
      }

      default:
        break;
    }

    return NextResponse.json({
      ok: true,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Webhook processing failed.",
      },
      { status: 500 },
    );
  }
}


