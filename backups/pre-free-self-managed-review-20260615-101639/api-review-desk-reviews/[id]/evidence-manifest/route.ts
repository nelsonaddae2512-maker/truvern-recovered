import { NextResponse } from "next/server";
import { getEvidenceManifestForReview } from "@/lib/evidence/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type Context = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: Context) {
  try {
    const params = await context.params;
    const reviewId = Number(params.id);

    if (!Number.isFinite(reviewId) || reviewId <= 0) {
      return NextResponse.json(
        { ok: false, error: "Missing or invalid review id." },
        { status: 400 },
      );
    }

    const manifest = await getEvidenceManifestForReview(reviewId);

    return NextResponse.json(
      {
        ok: true,
        artifactType: "truvern_review_evidence_manifest",
        reviewAssignmentId: reviewId,
        manifest,
      },
      {
        headers: {
          "content-disposition": `attachment; filename="truvern-evidence-manifest-${reviewId}.json"`,
        },
      },
    );
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to generate evidence manifest.",
      },
      { status: 500 },
    );
  }
}

