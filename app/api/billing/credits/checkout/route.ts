import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { headers } from "next/headers";
import Stripe from "stripe";

import { stripe } from "@/lib/stripe";
import { requireDbOrganization } from "@/lib/org-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const CREDIT_PACKS = {
  starter: {
    key: "starter",
    name: "Starter",
    credits: 5,
    envPriceKey: "STRIPE_PRICE_TRUVERN_CREDITS_STARTER",
  },
  growth: {
    key: "growth",
    name: "Growth",
    credits: 20,
    envPriceKey: "STRIPE_PRICE_TRUVERN_CREDITS_GROWTH",
  },
  scale: {
    key: "scale",
    name: "Scale",
    credits: 100,
    envPriceKey: "STRIPE_PRICE_TRUVERN_CREDITS_SCALE",
  },
} as const;

type PackKey = keyof typeof CREDIT_PACKS;

function safeBaseUrl() {
  const envUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.VERCEL_URL;

  if (envUrl) {
    return envUrl.startsWith("http") ? envUrl : `https://${envUrl}`;
  }

  return "http://localhost:3000";
}

function isPackKey(value: string): value is PackKey {
  return value in CREDIT_PACKS;
}

export async function POST(req: Request) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json(
      {
        ok: false,
        error: "Unauthorized",
      },
      { status: 401 },
    );
  }

  const org = await requireDbOrganization();

  if (!("id" in org)) {
    return NextResponse.json(
      {
        ok: false,
        error: "Select an organization before purchasing credits.",
      },
      { status: 400 },
    );
  }

  let body: unknown;

  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const packKey = String(
    (body as { pack?: unknown })?.pack || "",
  ).toLowerCase();

  const rawReturnTo = String(
    (body as { returnTo?: unknown })?.returnTo || "",
  ).trim();

  const returnTo =
    rawReturnTo.startsWith("/") && !rawReturnTo.startsWith("//")
      ? rawReturnTo
      : "/review-desk";

  if (!isPackKey(packKey)) {
    return NextResponse.json(
      {
        ok: false,
        error: "Invalid credit pack.",
        allowedPacks: Object.keys(CREDIT_PACKS),
      },
      { status: 400 },
    );
  }

  const pack = CREDIT_PACKS[packKey];
  const priceId = process.env[pack.envPriceKey];

  if (!priceId) {
    return NextResponse.json(
      {
        ok: false,
        error: "Stripe price is not configured.",
        missingEnv: pack.envPriceKey,
      },
      { status: 503 },
    );
  }

  if (!stripe) {
    return NextResponse.json(
      {
        ok: false,
        error: "Stripe client is unavailable.",
      },
      { status: 503 },
    );
  }

  const headerStore = await headers();
  const origin = headerStore.get("origin") || safeBaseUrl();

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",

      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],

      success_url: `${origin}/billing/credits?purchase=success&pack=${pack.key}&returnTo=${encodeURIComponent(returnTo)}`,

      cancel_url: `${origin}/billing/credits?purchase=cancelled&pack=${pack.key}&returnTo=${encodeURIComponent(returnTo)}`,

      client_reference_id: String(org.id),

      metadata: {
        userId,
        orgId: String(org.id),
        organizationId: String(org.id),
        organizationName: org.name || "",
        packKey: pack.key,
        packName: pack.name,
        credits: String(pack.credits),
        ledgerReason: "credit_pack_purchase",
        returnTo,
      },
    });

    return NextResponse.json({
      ok: true,
      url: session.url,
    });
  } catch (error) {
    const message =
      error instanceof Stripe.errors.StripeError
        ? error.message
        : "Failed to create checkout session.";

    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 500 },
    );
  }
}


