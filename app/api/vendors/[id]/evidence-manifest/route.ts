import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireDbOrganization } from "@/lib/org-db";
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

    const org = await requireDbOrganization();

    if ("_needsOrgSelection" in org) {
      return NextResponse.json(
        { ok: false, error: "Organization required." },
        { status: 403 },
      );
    }

    const vendor = await prisma.vendor.findFirst({
      where: {
        id: vendorId,
        organizationId: org.id,
      },
      select: {
        id: true,
      },
    });

    if (!vendor) {
      return NextResponse.json(
        { ok: false, error: "Vendor not found." },
        { status: 404 },
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

