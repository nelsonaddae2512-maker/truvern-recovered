import prisma from "@/lib/prisma";

export type VendorEvidenceRequestRow = {
  id: number;
  vendorId: number;
  organizationId: number;
  kind: string;
  status: string;
  title: string;
  notes: string | null;
  reviewNote: string | null;
  dueAt: Date | null;
  fulfilledEvidenceId: number | null;
  fulfilledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export async function readVendorEvidenceRequests(input: {
  vendorId: number;
  organizationId: number;
}): Promise<VendorEvidenceRequestRow[]> {
  return prisma.$queryRaw<VendorEvidenceRequestRow[]>`
    select
      er.id,
      er."vendorId",
      er."organizationId",
      er.kind::text as kind,
      er.status::text as status,
      er.title,
      er.notes,
      er."reviewNote",
      er."dueAt",
      er."fulfilledEvidenceId",
      er."fulfilledAt",
      er."createdAt",
      er."updatedAt"
    from "EvidenceRequest" er
    where er."vendorId" = ${input.vendorId}
      and er."organizationId" = ${input.organizationId}
    order by
      case er.status::text
        when 'REQUESTED' then 1
        when 'FULFILLED' then 2
        when 'APPROVED' then 3
        when 'REJECTED' then 4
        else 5
      end,
      er."dueAt" asc nulls last,
      er.id desc
  `;
}