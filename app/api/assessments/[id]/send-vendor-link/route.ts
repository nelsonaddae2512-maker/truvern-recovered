import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { requireDbOrganization } from "@/lib/org-db";
import { findAssessment } from "@/lib/repositories/assessment-repository";
import { sendAssessmentVendorLink } from "@/lib/communications/assessment-vendor-link";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

async function requireApiAuth() {
  const { userId } = await auth();

  if (!userId) {
    return {
      ok: false as const,
      response: NextResponse.json(
        {
          ok: false,
          error: "Unauthorized",
        },
        {
          status: 401,
          headers: {
            "cache-control": "no-store",
          },
        },
      ),
    };
  }

  try {
    const org =
      await requireDbOrganization();

    if (!("id" in org)) {
      return {
        ok: false as const,
        response: NextResponse.json(
          {
            ok: false,
            error: "Organization required",
          },
          {
            status: 403,
            headers: {
              "cache-control": "no-store",
            },
          },
        ),
      };
    }

    return {
      ok: true as const,
      userId,
      org,
    };
  } catch {
    return {
      ok: false as const,
      response: NextResponse.json(
        {
          ok: false,
          error: "Organization required",
        },
        {
          status: 403,
          headers: {
            "cache-control": "no-store",
          },
        },
      ),
    };
  }
}

type Params = {
  params:
    | Promise<{ id: string }>
    | { id: string };
};

function parseId(value: unknown) {
  const n =
    Number(
      String(value ?? "").trim(),
    );

  return Number.isFinite(n) &&
    n > 0
    ? Math.floor(n)
    : null;
}

function normalizeEmails(
  value: unknown,
) {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .map((v) =>
          String(v || "")
            .trim()
            .toLowerCase(),
        )
        .filter(Boolean),
    ),
  );
}

export async function POST(
  req: Request,
  { params }: Params,
) {
  const gate =
    await requireApiAuth();

  if (!gate.ok) {
    return gate.response;
  }

  try {
    const resolvedParams =
      await params;

    const assessmentId =
      parseId(resolvedParams.id);

    if (!assessmentId) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Invalid assessment id.",
        },
        { status: 400 },
      );
    }

    const body =
      await req
        .json()
        .catch(() => ({}));

    const recipients =
      normalizeEmails(
        body.recipients,
      );

    if (!recipients.length) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "At least one recipient is required.",
        },
        { status: 400 },
      );
    }

    const assessment =
      await findAssessment({
        where: {
          id: assessmentId,
        },
        select: {
          id: true,
          organizationId: true,
        },
      });

    if (
      !assessment ||
      assessment.organizationId !==
        gate.org.id
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Assessment not found.",
        },
        { status: 404 },
      );
    }

    const result =
      await sendAssessmentVendorLink({
        assessmentId:
          assessment.id,
        recipients,
        mode:
          "MANUAL_RESEND",
      });

    return NextResponse.json({
      ok: true,
      provider:
        result.alreadySent
          ? "existing"
          : undefined,
      recipients,
      delivery: {
        sent:
          result.sent,
        alreadySent:
          result.alreadySent,
      },
      communication: {
        mailboxId:
          result.mailboxId,
        conversationId:
          result.conversationId,
        messageId:
          result.messageId,
        providerMessageId:
          result.providerMessageId,
        simulated:
          result.simulated,
      },
    });
  } catch (error: any) {
    console.error(error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error?.message ||
          "Failed to send vendor review email.",
      },
      { status: 500 },
    );
  }
}