import "server-only";

type SendEmailHeaders = Record<string, string>;

type SendEmailRecipientValue =
  | string
  | string[];

type SendEmailArgs = {
  to: string;
  subject: string;
  html: string;
  from?: string;

  cc?: SendEmailRecipientValue;
  bcc?: SendEmailRecipientValue;
  replyTo?: string;

  headers?: SendEmailHeaders;
};

type ResendErrorShape = {
  message?: unknown;
  name?: unknown;
  statusCode?: unknown;
  status?: unknown;
  code?: unknown;
};

function isDev() {
  return process.env.NODE_ENV !== "production";
}

function cleanRecipientValue(
  value: SendEmailRecipientValue | undefined,
): SendEmailRecipientValue | undefined {
  if (Array.isArray(value)) {
    const cleaned =
      value
        .map((entry) => {
          return String(entry || "").trim();
        })
        .filter(Boolean);

    return cleaned.length
      ? cleaned
      : undefined;
  }

  const cleaned =
    typeof value === "string"
      ? value.trim()
      : "";

  return cleaned || undefined;
}

function cleanOptionalValue(
  value: string | undefined,
): string | undefined {
  const cleaned =
    typeof value === "string"
      ? value.trim()
      : "";

  return cleaned || undefined;
}

function cleanHeaders(
  headers: SendEmailHeaders | undefined,
): SendEmailHeaders | undefined {
  if (!headers) {
    return undefined;
  }

  const entries = Object.entries(headers)
    .map(([name, value]) => [
      String(name || "").trim(),
      String(value || "").trim(),
    ] as const)
    .filter(([name, value]) => {
      return Boolean(name && value);
    });

  if (!entries.length) {
    return undefined;
  }

  return Object.fromEntries(entries);
}

function providerError(
  value: unknown,
): Error {
  const record =
    value &&
    typeof value === "object"
      ? value as ResendErrorShape
      : {};

  const message =
    typeof record.message === "string" &&
    record.message.trim()
      ? record.message.trim()
      : "The email provider rejected the message.";

  const error =
    new Error(message) as Error & {
      code?: string;
      statusCode?: number;
    };

  if (
    typeof record.code === "string" &&
    record.code.trim()
  ) {
    error.code =
      record.code.trim();
  }
  else if (
    typeof record.name === "string" &&
    record.name.trim()
  ) {
    error.code =
      record.name.trim();
  }

  const status =
    typeof record.statusCode === "number"
      ? record.statusCode
      : typeof record.status === "number"
        ? record.status
        : null;

  if (status !== null) {
    error.statusCode =
      status;
  }

  return error;
}

export async function sendEmail({
  to,
  subject,
  html,
  from,
  cc,
  bcc,
  replyTo,
  headers,
}: SendEmailArgs) {
  const apiKey =
    String(
      process.env.RESEND_API_KEY ||
      "",
    ).trim();

  const configuredFrom =
    String(
      from ||
      process.env.RESEND_FROM ||
      "Truvern <no-reply@truvern.com>",
    ).trim();

  const resolvedTo =
    to.trim();

  const resolvedSubject =
    subject.trim();

  const resolvedCc =
    cleanRecipientValue(cc);

  const resolvedBcc =
    cleanRecipientValue(bcc);

  const resolvedReplyTo =
    cleanOptionalValue(replyTo);

  const resolvedHeaders =
    cleanHeaders(headers);

  if (!resolvedTo) {
    throw new Error(
      "An email recipient is required.",
    );
  }

  if (!resolvedSubject) {
    throw new Error(
      "An email subject is required.",
    );
  }

  if (!html.trim()) {
    throw new Error(
      "Email HTML content is required.",
    );
  }

  if (!apiKey) {
    if (isDev()) {
      console.warn(
        "[email:dev-fallback] RESEND_API_KEY missing; simulating send.",
      );

      console.warn({
        to: resolvedTo,
        cc: resolvedCc,
        bcc: resolvedBcc,
        replyTo: resolvedReplyTo,
        subject: resolvedSubject,
        from: configuredFrom,
        headers: resolvedHeaders,
      });

      return {
        ok: true as const,
        simulated: true as const,
        provider: "console" as const,
        providerMessageId: null,
        out: {
          id: null,
          data: {
            id: null,
          },
        },
      };
    }

    throw new Error(
      "Email provider not configured: RESEND_API_KEY missing.",
    );
  }

  let ResendCtor: any;

  try {
    ResendCtor =
      require("resend").Resend;
  }
  catch {
    throw new Error(
      "Email provider package is unavailable.",
    );
  }

  const resend =
    new ResendCtor(apiKey);

  const providerPayload: {
    from: string;
    to: string;
    subject: string;
    html: string;
    cc?: SendEmailRecipientValue;
    bcc?: SendEmailRecipientValue;
    replyTo?: string;
    headers?: SendEmailHeaders;
  } = {
    from: configuredFrom,
    to: resolvedTo,
    subject: resolvedSubject,
    html,
  };

  if (resolvedCc) {
    providerPayload.cc =
      resolvedCc;
  }

  if (resolvedBcc) {
    providerPayload.bcc =
      resolvedBcc;
  }

  if (resolvedReplyTo) {
    providerPayload.replyTo =
      resolvedReplyTo;
  }

  if (resolvedHeaders) {
    providerPayload.headers =
      resolvedHeaders;
  }

  const out =
    await resend.emails.send(
      providerPayload,
    );

  if (
    out &&
    typeof out === "object" &&
    "error" in out &&
    out.error
  ) {
    throw providerError(
      out.error,
    );
  }

  const providerMessageId =
    out &&
    typeof out === "object" &&
    "data" in out &&
    out.data &&
    typeof out.data === "object" &&
    "id" in out.data &&
    typeof out.data.id === "string"
      ? out.data.id.trim()
      : "";

  if (!providerMessageId) {
    throw new Error(
      "The email provider did not return a message ID.",
    );
  }

  return {
    ok: true as const,
    simulated: false as const,
    provider: "resend" as const,

    providerMessageId,

    out: {
      id:
        providerMessageId,

      data: {
        id:
          providerMessageId,
      },
    },
  };
}