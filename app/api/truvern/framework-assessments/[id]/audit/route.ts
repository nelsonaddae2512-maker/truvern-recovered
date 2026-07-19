import { NextResponse } from "next/server";
import { governanceAuthErrorResponse } from "@/lib/auth/governance-auth-errors";
import { requireReviewerAccess, requireFrameworkAssessmentAccess } from "@/lib/auth/truvern-governance";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteContext = {
  params: Promise<{ id: string }>;
};

function parseId(value: unknown) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id: rawId } = await context.params;
    const assessmentId = parseId(rawId);

    if (!assessmentId) {
      return NextResponse.json({ ok: false, error: "Invalid assessment id." }, { status: 400 });
    }

    await requireReviewerAccess();
    await requireFrameworkAssessmentAccess(assessmentId);

    const events = await prisma.$queryRawUnsafe<
      Array<{
        id: number;
        actorUserId: string | null;
        entityType: string;
        entityId: string;
        action: string;
        message: string | null;
        metadata: unknown;
        createdAt: Date;
      }>
    >(
      `
      select
        id,
        "actorUserId",
        "entityType",
        "entityId",
        action,
        message,
        metadata,
        "createdAt"
      from "AuditLog"
      where "entityType" = 'TruvernFrameworkAssessment'
        and "entityId" = $1
      order by "createdAt" desc, id desc
      limit 50
      `,
      String(assessmentId),
    );

    return NextResponse.json({
      ok: true,
      assessmentId,
      events,
    });
  } catch (error) {
    const authError = governanceAuthErrorResponse(error);
    if (authError) return authError;

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to load governance audit trail.",
      },
      { status: 500 },
    );
  }
}

