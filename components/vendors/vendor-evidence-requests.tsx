// components/vendors/vendor-evidence-requests.tsx
import prisma from "@/lib/prisma";
import VendorEvidenceRequestsPanel from "./vendor-evidence-requests-panel";

export default async function VendorEvidenceRequests({ vendorId }: { vendorId: number }) {
  const rows = await prisma.evidenceRequest.findMany({
    where: { vendorId },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    take: 100,
    select: {
      id: true,
      label: true,
      kind: true,
      status: true,
      dueAt: true,
      updatedAt: true,
      submittedAt: true,
      reviewedAt: true,
      iterations: {
        take: 1,
        orderBy: [{ submittedAt: "desc" as any }, { id: "desc" as any }] as any,
        select: {
          id: true,
          status: true,
          submittedAt: true,
          reviewedAt: true,
          _count: { select: { files: true } },
        } as any,
      } as any,
    } as any,
  });

  const normalized = rows.map((r: any) => {
    const latest = r.iterations?.[0] ?? null;
    return {
      id: r.id,
      label: r.label,
      kind: r.kind,
      status: String(r.status ?? "OPEN"),
      dueAt: r.dueAt,
      updatedAt: r.updatedAt,
      submittedAt: r.submittedAt,
      reviewedAt: r.reviewedAt,
      latestIterationId: latest?.id ?? null,
      latestIterationStatus: latest ? String(latest.status ?? "") : null,
      filesCount: latest?._count?.files ?? 0,
    };
  });

  return <VendorEvidenceRequestsPanel vendorId={vendorId} />;
}



