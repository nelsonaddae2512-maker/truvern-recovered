import prisma from "@/lib/prisma";

export type VendorAssessmentLatestReleaseRow = {
  assignmentId: number | null;
  requestId: number | null;
  assignmentStatus: string | null;
  releaseState: string | null;
  intent: string | null;
};

export type VendorAssessmentEvidenceRequestRow = {
  id: number;
  status: string | null;
  title: string | null;
  notes: string | null;
  reviewNote: string | null;
  dueAt: Date | string | null;
  fulfilledEvidenceId: number | null;
  fulfilledAt: Date | string | null;
  createdAt: Date | string | null;
  packageId: number | null;
  packageTitle: string | null;
  packageStatus: string | null;
  packageSeverity: string | null;
  packagePayload: any;
};

export async function readVendorAssessmentLatestRelease(
  vendorId: number,
): Promise<VendorAssessmentLatestReleaseRow[]> {
  return prisma.$queryRaw<VendorAssessmentLatestReleaseRow[]>`
    select
      ra.id as "assignmentId",
      rr.id as "requestId",
      ra.status::text as "assignmentStatus",
      coalesce(resp.responses->>'releaseState', '')::text as "releaseState",
      coalesce(resp.responses->>'intent', '')::text as intent
    from "ReviewRequest" rr
    join "ReviewAssignment" ra
      on ra."reviewRequestId" = rr.id
    left join lateral (
      select r.responses
      from "ReviewResponse" r
      where r."reviewAssignmentId" = ra.id
      order by r."updatedAt" desc, r.id desc
      limit 1
    ) resp on true
    where rr."vendorId" = ${vendorId}
    order by ra."updatedAt" desc, ra.id desc
    limit 1
  `;
}

export async function readVendorAssessmentEvidenceRequests(input: {
  assessmentId: number;
  vendorId: number;
}): Promise<VendorAssessmentEvidenceRequestRow[]> {
  return prisma.$queryRaw<VendorAssessmentEvidenceRequestRow[]>`
    select
      er.id,
      er.status::text as status,
      er.title,
      er.notes,
      er."reviewNote",
      er."dueAt",
      er."fulfilledEvidenceId",
      er."fulfilledAt",
      er."createdAt",
      rp.id as "packageId",
      rp.title as "packageTitle",
      rp.status as "packageStatus",
      rp.severity as "packageSeverity",
      rp.payload as "packagePayload"
    from "EvidenceRequest" er
    left join "RemediationPackage" rp
      on rp."evidenceRequestId" = er.id
    left join "AssessmentRun" ar
      on ar.id = er."assessmentRunId"
    where (
      ar."assessmentId" = ${input.assessmentId}
      or er."vendorId" = ${input.vendorId}
    )
      and upper(coalesce(er.status::text, '')) <> 'CANCELLED'
    order by er."createdAt" desc
  `;
}