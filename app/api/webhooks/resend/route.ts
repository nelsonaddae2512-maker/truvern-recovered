import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

import { ingestResendInboundEmail } from "@/lib/communications/inbound";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type WebhookEvent = {
  type?: unknown;
  data?: unknown;
};

function response(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, {
    status,
    headers: {
      "cache-control": "no-store",
    },
  });
}

function requireHeader(request: NextRequest, name: string): string {
  const value = request.headers.get(name)?.trim();

  if (!value) {
    throw new Error(`Missing ${name} header.`);
  }

  return value;
}

export async function POST(request: NextRequest) {
  let rawBody: string;

  try {
    rawBody = await request.text();
  } catch {
    return response(400, {
      ok: false,
      error: "Unable to read webhook body.",
    });
  }

  const apiKey = process.env.RESEND_API_KEY?.trim();
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET?.trim();

  if (!apiKey || !webhookSecret) {
    console.error("webhooks.resend.configuration.missing");

    return response(500, {
      ok: false,
      error: "Webhook configuration is incomplete.",
    });
  }

  let event: WebhookEvent;

  try {
    const resend = new Resend(apiKey);

    event = resend.webhooks.verify({
      payload: rawBody,
      headers: {
        id: requireHeader(request, "svix-id"),
        timestamp: requireHeader(request, "svix-timestamp"),
        signature: requireHeader(request, "svix-signature"),
      },
      webhookSecret,
    }) as WebhookEvent;
  } catch (error) {
    console.error("webhooks.resend.verification.failed", error);

    return response(400, {
      ok: false,
      error: "Invalid webhook signature.",
    });
  }

  if (event.type !== "email.received") {
    return response(200, {
      ok: true,
      ignored: true,
      eventType: typeof event.type === "string" ? event.type : null,
    });
  }

  if (
    !event.data ||
    typeof event.data !== "object" ||
    Array.isArray(event.data)
  ) {
    return response(400, {
      ok: false,
      error: "Webhook data is invalid.",
    });
  }

  try {
    const result = await ingestResendInboundEmail(event.data);

    return response(200, {
      ...result,
      eventType: "email.received",
    });
  } catch (error) {
    console.error("webhooks.resend.inbound.failed", error);

    return response(500, {
      ok: false,
      error: "Inbound email could not be processed.",
    });
  }
}
