// lib/email.ts
import "server-only";

type SendEmailArgs = {
  to: string;
  subject: string;
  html: string;
  from?: string;
};

function isDev() {
  return process.env.NODE_ENV !== "production";
}

function mask(s: string) {
  if (!s) return "";
  if (s.length <= 8) return "***";
  return s.slice(0, 4) + "€¦" + s.slice(-4);
}

export async function sendEmail({ to, subject, html, from }: SendEmailArgs) {
  const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
  const RESEND_FROM = from || process.env.RESEND_FROM || "Truvern <no-reply@truvern.com>";

  // If key missing, don't hard fail in dev.
  if (!RESEND_API_KEY) {
    if (isDev()) {
      console.log("[email:dev-fallback] RESEND_API_KEY missing; simulating send");
      console.log({ to, subject, from: RESEND_FROM });
      return { ok: true as const, simulated: true as const, provider: "console" as const };
    }
    throw new Error("Email provider not configured: RESEND_API_KEY missing");
  }

  // Lazy import so dev fallback doesn't require package
  let ResendCtor: any;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    ResendCtor = require("resend").Resend;
  } catch (e) {
    if (isDev()) {
      console.log("[email:dev-fallback] 'resend' package missing; simulating send");
      console.log({ to, subject, from: RESEND_FROM });
      return { ok: true as const, simulated: true as const, provider: "console" as const };
    }
    throw e;
  }

  try {
    const resend = new ResendCtor(RESEND_API_KEY);
    const out = await resend.emails.send({
      from: RESEND_FROM,
      to,
      subject,
      html,
    });

    return { ok: true as const, provider: "resend" as const, out };
  } catch (e: any) {
    // If key invalid (401), fall back in dev so the app keeps working
    const msg = String(e?.message || "");
    const status = e?.statusCode || e?.status;

    if (isDev()) {
      console.log("[email:dev-fallback] Resend failed; simulating send");
      console.log("reason:", { status, message: msg, key: mask(RESEND_API_KEY) });
      console.log({ to, subject, from: RESEND_FROM });
      return { ok: true as const, simulated: true as const, provider: "console" as const };
    }

    throw e;
  }
}




