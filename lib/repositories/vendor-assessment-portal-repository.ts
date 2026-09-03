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

export async function readVendorAssessmentLatestRelease(input: {
  assessmentId: number;
  vendorId: number;
  organizationId: number;
}): Promise<VendorAssessmentLatestReleaseRow[]> {
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
    where rr."assessmentId" = ${input.assessmentId}
      and rr."vendorId" = ${input.vendorId}
      and rr."organizationId" = ${input.organizationId}
    order by ra."updatedAt" desc, ra.id desc
    limit 1
  `;
}

export async function readVendorAssessmentEvidenceRequests(input: {
  assessmentId: number;
  vendorId: number;
  organizationId: number;
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
    left join lateral (
      select
        scoped_rp.id,
        scoped_rp.title,
        scoped_rp.status,
        scoped_rp.severity,
        scoped_rp.payload
      from "RemediationPackage" scoped_rp
      join "ReviewAssignment" scoped_ra
        on scoped_ra.id = scoped_rp."reviewAssignmentId"
      join "ReviewRequest" scoped_rr
        on scoped_rr.id = scoped_ra."reviewRequestId"
      where scoped_rp."evidenceRequestId" = er.id
        and scoped_rp."vendorId" = ${input.vendorId}
        and scoped_rp."organizationId" = ${input.organizationId}
        and scoped_rr."assessmentId" = ${input.assessmentId}
        and scoped_rr."vendorId" = ${input.vendorId}
        and scoped_rr."organizationId" = ${input.organizationId}
        and upper(coalesce(scoped_rp.status, '')) <> 'CANCELLED'
      order by scoped_rp."updatedAt" desc, scoped_rp.id desc
      limit 1
    ) rp on true
    left join "AssessmentRun" ar
      on ar.id = er."assessmentRunId"
    where er."vendorId" = ${input.vendorId}
      and er."organizationId" = ${input.organizationId}
      and (
        ar."assessmentId" = ${input.assessmentId}
        or exists (
          select 1
          from "RemediationPackage" scoped_rp
          join "ReviewAssignment" scoped_ra
            on scoped_ra.id = scoped_rp."reviewAssignmentId"
          join "ReviewRequest" scoped_rr
            on scoped_rr.id = scoped_ra."reviewRequestId"
          where scoped_rp."evidenceRequestId" = er.id
            and scoped_rr."assessmentId" = ${input.assessmentId}
            and scoped_rr."vendorId" = ${input.vendorId}
            and scoped_rr."organizationId" = ${input.organizationId}
        )
      )
      and upper(coalesce(er.status::text, '')) <> 'CANCELLED'
    order by er."createdAt" desc
  `;
}