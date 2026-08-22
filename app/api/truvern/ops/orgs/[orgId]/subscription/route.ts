import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import prisma from "@/lib/prisma";
import {
  createSubscription,
  findBillingPlanByTier,
  updateOrganizationSubscriptions,
  findSubscriptionOrganizationById,
} from "@/lib/repositories/subscription-repository";
import { requireTruvernOperator } from "@/lib/truvern-ops-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type Params = {
  params: Promise<{ orgId: string }>;
};

type RequestBody = Record<string, unknown>;

const PAYMENT_SOURCES = new Set([
  "STRIPE",
  "CHECK",
  "ACH",
  "WIRE",
  "INVOICE",
  "CONTRACT",
  "OTHER",
]);

function safeString(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const trimmed = value.trim();

  return trimmed || null;
}

function safeTier(
  value: unknown,
): "PRO" | "ENTERPRISE" | null {
  const normalized = safeString(value)?.toUpperCase();

  if (
    normalized === "PRO" ||
    normalized === "ENTERPRISE"
  ) {
    return normalized;
  }

  return null;
}

function safePaymentSource(value: unknown): string | null {
  const normalized = safeString(value)?.toUpperCase();

  if (
    !normalized ||
    !PAYMENT_SOURCES.has(normalized)
  ) {
    return null;
  }

  return normalized;
}

function safeDate(value: unknown): Date | null {
  const text = safeString(value);

  if (!text) return null;

  const date = new Date(text);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function safeOptionalInteger(
  value: unknown,
): number | null {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const parsed = Number(value);

  if (
    !Number.isInteger(parsed) ||
    parsed < 0
  ) {
    return null;
  }

  return parsed;
}

async function readBody(
  request: Request,
): Promise<RequestBody> {
  const contentType =
    request.headers.get("content-type") || "";

  if (
    contentType.includes("application/json")
  ) {
    return request.json().catch(() => ({}));
  }

  const form =
    await request.formData().catch(() => null);

  if (!form) return {};

  return Object.fromEntries(form.entries());
}

function errorResponse(
  message: string,
  status: number,
) {
  return NextResponse.json(
    {
      ok: false,
      error: message,
    },
    {
      status,
    },
  );
}

export async function POST(
  request: Request,
  context: Params,
) {
  const operator =
    await requireTruvernOperator();

  const { userId } = await auth();

  const { orgId } = await context.params;

  const organizationId = Number(orgId);

  if (
    !Number.isInteger(organizationId) ||
    organizationId <= 0
  ) {
    return errorResponse(
      "Invalid organization id.",
      400,
    );
  }

  const organization =
    await findSubscriptionOrganizationById(
      organizationId,
    );

  if (!organization) {
    return errorResponse(
      "Organization not found.",
      404,
    );
  }

  const body = await readBody(request);

  const planTier =
    safeTier(body.planTier);

  const paymentSource =
    safePaymentSource(body.paymentSource);

  const startsAt =
    safeDate(body.startsAt) ?? new Date();

  const currentPeriodEnd =
    safeDate(body.currentPeriodEnd);

  const paidAt =
    safeDate(body.paidAt) ?? new Date();

  const paymentReference =
    safeString(body.paymentReference);

  const notes =
    safeString(body.notes);

  const currency =
    safeString(body.currency)?.toUpperCase() ??
    "USD";

  const amountCents =
    safeOptionalInteger(body.amountCents);

  const stripeCustomerId =
    safeString(body.stripeCustomerId);

  const stripeSubId =
    safeString(body.stripeSubId);

  if (!planTier) {
    return errorResponse(
      "Plan tier must be PRO or ENTERPRISE.",
      400,
    );
  }

  if (!paymentSource) {
    return errorResponse(
      "Invalid payment source.",
      400,
    );
  }

  /*
   * Every paid subscription must have a finite term.
   * This prevents offline payments from accidentally
   * creating permanent PRO / ENTERPRISE access.
   */
  if (!currentPeriodEnd) {
    return errorResponse(
      "Subscription expiration is required.",
      400,
    );
  }

  if (currentPeriodEnd <= startsAt) {
    return errorResponse(
      "Subscription expiration must be after its start date.",
      400,
    );
  }

  if (
    paymentSource === "STRIPE" &&
    !stripeSubId
  ) {
    return errorResponse(
      "Stripe subscription id is required for Stripe payments.",
      400,
    );
  }

  if (
    paymentSource !== "STRIPE" &&
    !paymentReference
  ) {
    return errorResponse(
      "Payment reference is required for offline payments.",
      400,
    );
  }

  const plan =
    await findBillingPlanByTier(planTier);

  if (!plan) {
    return errorResponse(
      `${planTier} billing plan is not configured.`,
      409,
    );
  }

  const subscription =
    await prisma.$transaction(async (tx) => {
      /*
       * Preserve historical subscription rows while
       * ensuring only the newly activated paid term
       * remains ACTIVE.
       */
      await updateOrganizationSubscriptions(
        {
          where: {
            organizationId,
            status: "ACTIVE",
          },
          data: {
            status: "INACTIVE",
          },
        },
        tx,
      );

      return createSubscription(
        {
          data: {
            organizationId,
            planId: plan.id,
            status: "ACTIVE",

            paymentSource,
            startsAt,
            currentPeriodEnd,
            paidAt,

            paymentReference,
            amountCents,
            currency,

            createdByUserId:
              userId ??
              operator.userId ??
              null,

            notes,

            stripeCustomerId:
              paymentSource === "STRIPE"
                ? stripeCustomerId
                : null,

            stripeSubId:
              paymentSource === "STRIPE"
                ? stripeSubId
                : null,
          },
          include: {
            plan: {
              select: {
                id: true,
                tier: true,
                name: true,
              },
            },
          },
        },
        tx,
      );
    });

  const wantsJson =
    request.headers
      .get("accept")
      ?.includes("application/json") ||
    request.headers
      .get("content-type")
      ?.includes("application/json");

  if (wantsJson) {
    return NextResponse.json({
      ok: true,
      organization: {
        id: organization.id,
        name: organization.name,
      },
      subscription: {
        id: subscription.id,
        status: subscription.status,
        planTier: subscription.plan.tier,
        paymentSource:
          subscription.paymentSource,
        startsAt:
          subscription.startsAt,
        currentPeriodEnd:
          subscription.currentPeriodEnd,
        paidAt:
          subscription.paidAt,
        paymentReference:
          subscription.paymentReference,
        amountCents:
          subscription.amountCents,
        currency:
          subscription.currency,
      },
    });
  }

  return NextResponse.redirect(
    new URL(
      `/truvern/ops/funding/${organizationId}` +
        `?status=subscription-activated`,
      request.url,
    ),
    303,
  );
}
