import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = {
  params: Promise<{ id: string }> | { id: string };
};

export async function POST(_req: Request, props: Props) {
  try {
    const resolved = await props.params;
    const packageId = Number(resolved.id);

    if (!Number.isFinite(packageId) || packageId <= 0) {
      return NextResponse.json({ ok: false, error: "Package id required." }, { status: 400 });
    }

    const rows: any[] = await prisma.$queryRawUnsafe(
      `
      update "RemediationPackage"
      set status = 'SUBMITTED', "updatedAt" = now()
      where id = $1
      returning id, "evidenceRequestId"
      `,
      packageId,
    );

    const row = rows?.[0];

    if (!row) {
      return NextResponse.json({ ok: false, error: "Remediation package not found." }, { status: 404 });
    }

    if (row.evidenceRequestId) {
      await prisma.$executeRawUnsafe(
        `
        update "EvidenceRequest"
        set status = 'SUBMITTED'::"EvidenceRequestStatus", "updatedAt" = now()
        where id = $1
        `,
        Number(row.evidenceRequestId),
      );
    }

    return NextResponse.json({
      ok: true,
      packageId,
      status: "SUBMITTED",
      message: "Remediation package submitted for Truvern review.",
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: String(error?.message || "Failed to submit remediation package.") },
      { status: 500 },
    );
  }
}
