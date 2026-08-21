import { NextResponse } from "next/server";
import { requireReviewerAccess } from "@/lib/auth/truvern-governance";
import prisma from "@/lib/prisma";
import { findEvidenceRequests } from "@/lib/repositories/evidence-request-repository";
import { findEvidence } from "@/lib/repositories/evidence-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteContext = {
  params: Promise<{
    vendorId?: string;
  }>;
};

function safeInt(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export async function GET(_req: Request, context: RouteContext) {
  try {
    await requireReviewerAccess();
    const params = await context.params;
    const vendorId = safeInt(params?.vendorId);

    if (!vendorId) {
      return NextResponse.json(
        { ok: false, error: "Invalid vendor id." },
        { status: 400 },
      );
    }

    const requests = await findEvidenceRequests({
      where: {
        vendorId,
      },
      select: {
        id: true,
        title: true,
        status: true,
        fulfilledEvidenceId: true,
        fulfilledAt: true,
        reviewNote: true,
        updatedAt: true,
      },
      orderBy: [
        { updatedAt: "desc" },
        { id: "desc" },
      ],
    });

    const fulfilledEvidenceIds = Array.from(
      new Set(
        requests
          .map((request) => request.fulfilledEvidenceId)
          .filter((id): id is number => typeof id === "number"),
      ),
    );

    const fulfilledEvidence =
      fulfilledEvidenceIds.length > 0
        ? await findEvidence({
            where: {
              id: {
                in: fulfilledEvidenceIds,
              },
            },
            select: {
              id: true,
              title: true,
              notes: true,
              url: true,
              createdAt: true,
            },
          })
        : [];

    const evidenceById = new Map(
      fulfilledEvidence.map((evidence) => [evidence.id, evidence]),
    );

    const rows = requests.map((request) => {
      const evidence = request.fulfilledEvidenceId
        ? evidenceById.get(request.fulfilledEvidenceId) ?? null
        : null;

      return {
        requestId: request.id,
        requestTitle: request.title,
        requestStatus: String(request.status),
        fulfilledEvidenceId: request.fulfilledEvidenceId,
        fulfilledAt: request.fulfilledAt,
        reviewNote: request.reviewNote,
        evidenceId: evidence?.id ?? null,
        evidenceTitle: evidence?.title ?? null,
        evidenceNotes: evidence?.notes ?? null,
        evidenceUrl: evidence?.url ?? null,
        evidenceUploadedAt: evidence?.createdAt ?? null,
      };
    });

    return NextResponse.json({
      ok: true,
      vendorId,
      submissions: rows,
    });
  } catch (error: any) {
    console.error("Review desk evidence submissions lookup failed:", error);

    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to load evidence submissions." },
      { status: 500 },
    );
  }
}


