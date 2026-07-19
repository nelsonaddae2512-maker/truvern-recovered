import { NextResponse } from "next/server";
import { getEvidenceManifestForVendor } from "@/lib/evidence/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type Context = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: Context) {
  try {
    const params = await context.params;
    const vendorId = Number(params.id);

    if (!Number.isFinite(vendorId) || vendorId <= 0) {
      return NextResponse.json(
        { ok: false, error: "Missing or invalid vendor id." },
        { status: 400 },
      );
    }

    const manifest = await getEvidenceManifestForVendor(vendorId);

    return NextResponse.json(
      {
        ok: true,
        artifactType: "truvern_vendor_evidence_manifest",
        vendorId,
        manifest,
      },
      {
        headers: {
          "content-disposition": `attachment; filename="truvern-vendor-evidence-manifest-${vendorId}.json"`,
        },
      },
    );
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate vendor evidence manifest.",
      },
      { status: 500 },
    );
  }
}

