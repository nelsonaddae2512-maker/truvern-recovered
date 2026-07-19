// lib/stripe.ts
import Stripe from "stripe";

let stripeClient: Stripe | null = null;

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY not set");
  }
  if (!stripeClient) {
    stripeClient = new Stripe(key, {
      apiVersion: "2026-02-25.clover",
    });
  }
  return stripeClient;
}

export const stripe = (() => {
  try {
    return getStripe();
  } catch {
    // For builds where Stripe is not configured yet,
    // we export a dummy object €“ routes should guard at runtime.
    return null as unknown as Stripe;
  }
})();








