// lib/billing.ts

export const PLAN_PRICE_IDS: Record<string, string> = {
  free: "",
  pro: process.env.STRIPE_PRICE_PRO_ID || "",
  enterprise: process.env.STRIPE_PRICE_ENTERPRISE_ID || "",
};

export default { PLAN_PRICE_IDS };



