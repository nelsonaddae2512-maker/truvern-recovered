import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import {
  getCurrentOrgPlanTier,
} from "@/lib/billing/plan-access";
import { requireDbOrganization } from "@/lib/org-db";
import {
  launchAssessment,
} from "@/lib/services/assessment-launch-service";

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
    const org = await requireDbOrganization();

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

function parseId(value: unknown): number | null {
  const parsed = Number(
    String(value ?? "").trim(),
  );

  return Number.isFinite(parsed) && parsed > 0
    ? Math.floor(parsed)
    : null;
}

function parseDueAt(value: unknown): Date | null {
  const raw = String(value ?? "").trim();

  if (!raw) {
    return null;
  }

  const date =
    new Date(`${raw}T12:00:00.000Z`);

  return Number.isNaN(date.getTime())
    ? null
    : date;
}

export async function POST(
  req: Request,
  { params }: Params,
) {
  const gate = await requireApiAuth();

  if (!gate.ok) {
    return gate.response;
  }

  const resolvedParams = await params;
  const vendorId = parseId(resolvedParams.id);

  if (!vendorId) {
    return NextResponse.json(
      {
        ok: false,
        error: "Invalid vendor id.",
      },
      {
        status: 400,
      },
    );
  }

  const body =
    await req.json().catch(() => ({}));

  const templateId = parseId(body.templateId);
  const title =
    String(body.title ?? "").trim();

  const dueAt = parseDueAt(body.dueAt);

  if (!templateId) {
    return NextResponse.json(
      {
        ok: false,
        error: "Template is required.",
      },
      {
        status: 400,
      },
    );
  }

  const currentPlanTier =
    await getCurrentOrgPlanTier();

  const result = await launchAssessment({
    vendorId,
    templateId,
    currentPlanTier,
    title,
    dueAt,
  });

  if (!result.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: result.error,
      },
      {
        status: result.status,
      },
    );
  }

  return NextResponse.json({
    ok: true,
    ...(result.reused
      ? {
          reused: true,
        }
      : {}),
    id: result.id,
    assessmentId: result.assessmentId,
    assessmentRunId:
      result.assessmentRunId,
    token: result.token,
    vendorUrl: result.vendorUrl,
    redirectUrl: result.redirectUrl,
  });
}