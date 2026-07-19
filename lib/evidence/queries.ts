import prisma from "@/lib/prisma";

export type ReviewEvidenceItem = {
  id: number;
  title: string;
  kind: string;
  notes: string | null;
  url: string | null;
  fileUrl: string | null;
  fileKey: string | null;
  status: string | null;
  decision: string | null;
  requestTitle: string | null;
  checksum: string | null;
  uploadedAt: Date | null;
  uploadedBy: string | null;
  reviewedAt: Date | null;
  createdAt: Date | null;
  updatedAt: Date | null;
  documentDate: Date | null;
  validUntil: Date | null;
};

function safeStr(value: unknown) {
  return typeof value === "string" ? value : "";
}

function mapEvidence(row: any): ReviewEvidenceItem {
  return {
    id: Number(row.id),
    title: safeStr(row.title),
    kind: safeStr(row.kind),
    notes: safeStr(row.notes) || null,

    url: safeStr(row.url) || null,
    fileUrl: safeStr(row.url) || null,
    fileKey: null,

    status: safeStr(row.status) || null,
    decision: safeStr(row.decision) || null,

    requestTitle: safeStr(row.requestTitle) || null,
    checksum: safeStr(row.checksum) || null,

    uploadedAt: row.createdAt || null,
    uploadedBy: safeStr(row.uploadedBy) || null,
    reviewedAt: row.reviewedAt || null,

    createdAt: row.createdAt || null,
    updatedAt: row.updatedAt || null,
    documentDate: row.documentDate || null,
    validUntil: row.validUntil || null,
  };
}

export async function getVendorEvidence(vendorId: number) {
  const rows = await prisma.$queryRawUnsafe(`
    select
      e.id,
      e.title,
      e.kind,
      e.notes,
      e.url,
      e."createdAt",
      e."updatedAt",
      e."documentDate",
      e."validUntil",
      er.title as "requestTitle",
      er.status,
      null::text as decision,
      null::text as checksum,
      null::timestamp as "reviewedAt",
      null::text as "uploadedBy"
    from "Evidence" e
    left join "EvidenceRequest" er
      on er.id = e."evidenceRequestId"
    where e."vendorId" = ${Number(vendorId)}
    order by e."createdAt" desc
  `);

  return Array.isArray(rows) ? rows.map(mapEvidence) : [];
}

export async function getEvidenceForReview(reviewAssignmentId: number) {
  const rows = await prisma.$queryRawUnsafe(`
    select
      e.id,
      e.title,
      e.kind,
      e.notes,
      e.url,
      e."createdAt",
      e."updatedAt",
      e."documentDate",
      e."validUntil",
      er.title as "requestTitle",
      er.status,
      null::text as decision,
      null::text as checksum,
      null::timestamp as "reviewedAt",
      null::text as "uploadedBy"
    from "Evidence" e
    inner join "EvidenceRequest" er
      on er.id = e."evidenceRequestId"
    inner join "ReviewAssignment" ra
      on ra.id = ${Number(reviewAssignmentId)}
     and ra."vendorId" = er."vendorId"
     and ra."organizationId" = er."organizationId"
    order by e."createdAt" desc
  `);

  return Array.isArray(rows) ? rows.map(mapEvidence) : [];
}

export async function getReviewEvidence(reviewAssignmentId: number) {
  return getEvidenceForReview(reviewAssignmentId);
}

export async function getEvidenceManifestForReview(reviewAssignmentId: number) {
  return getEvidenceForReview(reviewAssignmentId);
}

export async function getEvidenceManifestForVendor(vendorId: number) {
  return getVendorEvidence(vendorId);
}


