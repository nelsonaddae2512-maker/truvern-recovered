// components/vendors/vendor-evidence-requests-panel.tsx
import Link from "next/link";
import prisma from "@/lib/prisma";
import VendorEvidenceRequestsClient from "./vendor-evidence-requests-client";

export default async function VendorEvidenceRequestsPanel({
  vendorId,
}: {
  vendorId: number;
}) {
  // Safe query: if schema mismatches happen, return empty list rather than crash
  let requests: any[] = [];
  try {
    requests = await (prisma as any).evidenceRequest.findMany({
      where: { vendorId } as any,
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }] as any,
      take: 100,
      select: {
        id: true,
        vendorId: true,
        label: true,
        kind: true,
        status: true,
        dueAt: true,
        createdAt: true,
        updatedAt: true,
        submittedAt: true,
        reviewedAt: true,
        reviewNote: true,
      } as any,
    });
  } catch {
    requests = [];
  }

  return (
    <section
      id="evidence"
      className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-lg font-semibold text-white">Evidence Requests</div>
          <div className="mt-1 text-sm text-white/60">
            Track lifecycle from <span className="text-white/80">OPEN</span> †’{" "}
            <span className="text-white/80">SUBMITTED</span> †’{" "}
            <span className="text-white/80">APPROVED/REJECTED</span>.
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* The €œwhere you can request evidence€ destination */}
          <Link className="btn-glass" href="/evidence">
            Evidence Hub †—
          </Link>

          {/* If you later add a real €œcreate request€ page, change this href */}
          <Link className="btn-primary" href={`/evidence?vendorId=${vendorId}`}>
            Request Evidence
          </Link>

          <Link className="btn-glass" href="/org/evidence-requests">
            Review Inbox †—
          </Link>
        </div>
      </div>

      <div className="mt-4">
        <VendorEvidenceRequestsClient vendorId={vendorId} requests={requests} />
      </div>

      <div className="mt-3 text-xs text-white/40">
        Status changes here are for quick admin adjustments. For formal review, use{" "}
        <span className="text-white/60">Review Inbox</span> /{" "}
        <span className="text-white/60">Review</span> links.
      </div>
    </section>
  );
}



