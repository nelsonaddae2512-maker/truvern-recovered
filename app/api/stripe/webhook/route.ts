import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import Stripe from "stripe";

import { stripe } from "@/lib/stripe";
import {
  countStripeCreditEntriesByEventKey,
  insertStripeCreditPurchase,
} from "@/lib/repositories/stripe-credit-purchase-repository";

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

  const existingRows =
    await countStripeCreditEntriesByEventKey(eventKey);

  if ((existingRows?.[0]?.count ?? 0) > 0) {
    return {
      ok: true,
      duplicate: true,
      eventKey,
    };
  }

  await insertStripeCreditPurchase({
    organizationId: input.organizationId,
    userId: input.userId,
    eventKey,
    credits: input.credits,
    note: `Purchased ${input.credits} Truvern credit${input.credits === 1 ? "" : "s"} via Stripe Checkout.`,
    metadataJson: JSON.stringify({
      source: "stripe_checkout",
      stripeSessionId: input.stripeSessionId,
      stripePaymentIntentId: input.stripePaymentIntentId || null,
      credits: input.credits,
      packKey: input.packKey || null,
      packName: input.packName || null,
    }),
  });

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


