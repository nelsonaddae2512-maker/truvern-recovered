import prisma from "@/lib/prisma";

export type VendorDetailContactRow = {
  id: number;
  name: string | null;
  email: string;
  role: string | null;
  phone: string | null;
  isPrimary: boolean;
};

export type VendorDetailTemplateRow = {
  id: number;
  name: string;
  description: string | null;
  standard: string | null;
  category: string | null;
  version: string | null;
  isActive: boolean;
  accessTier: string | null;
  source: string | null;
  origin: string | null;
  isSystem: boolean | null;
  isFeatured: boolean | null;
  sectionCount: number;
  questionCount: number;
  sections: any[];
};

export type VendorDetailAssessmentRegistryRow = {
  assignmentId: number | null;
  assessmentRunId: number | null;
  status: string | null;
  assignmentType: string | null;
  releaseState: string | null;
  intent: string | null;
  riskLevel: string | null;
  decision: string | null;
  reviewerUserId: string | null;
  reviewerName: string | null;
  createdAt: Date | string | null;
  updatedAt: Date | string | null;
  releasedAt: string | null;
  confirmedAt: string | null;
  checksum: string | null;
  manifestId: number | null;
};

export type VendorDetailGovernanceMetricRow = {
  evidenceCount: number;
  evidenceRequestCount: number;
  activeReviewCount: number;
  issueCount: number;
};

export async function readVendorDetailContacts(
  vendorId: number,
): Promise<VendorDetailContactRow[]> {
  return prisma.$queryRaw<VendorDetailContactRow[]>`
    select
      id,
      name,
      email,
      role,
      phone,
      "isPrimary"
    from "VendorContact"
    where "vendorId" = ${vendorId}
    order by "isPrimary" desc, "createdAt" asc, id asc
  `;
}

export async function readVendorDetailAssessmentTemplates(): Promise<
  VendorDetailTemplateRow[]
> {
  return prisma.$queryRaw<VendorDetailTemplateRow[]>`
    select
      t.id,
      t.name,
      t.description,
      t.standard,
      t.category,
      t.version,
      t."isActive",
      t."accessTier"::text as "accessTier",
      t.source::text as source,
      t.origin::text as origin,
      t."isSystem",
      t."isFeatured",
      (
        select count(*)::int
        from "AssessmentSection" s
        where s."templateId" = t.id
      ) as "sectionCount",
      (
        select count(*)::int
        from "AssessmentQuestion" q
        where q."templateId" = t.id
      ) as "questionCount",
      coalesce(
        (
          select jsonb_agg(
            section_row
            order by
              (section_row->>'order')::int,
              (section_row->>'id')::int
          )
          from (
            select jsonb_build_object(
              'id', s.id,
              'title', s.title,
              'description', s.description,
              'order', s."order",
              'questions',
              coalesce(
                (
                  select jsonb_agg(
                    jsonb_build_object(
                      'id', q.id,
                      'text', q.text,
                      'type', q.type::text,
                      'required', q.required
                    )
                    order by q."orderIndex" asc, q.id asc
                  )
                  from "AssessmentQuestion" q
                  where q."sectionId" = s.id
                  limit 4
                ),
                '[]'::jsonb
              )
            ) as section_row
            from "AssessmentSection" s
            where s."templateId" = t.id
            order by s."order" asc, s.id asc
            limit 4
          ) x
        ),
        '[]'::jsonb
      ) as sections
    from "AssessmentTemplate" t
    where t."isActive" = true
    order by
      t."isFeatured" desc,
      case t."accessTier"::text
        when 'FREE' then 1
        when 'PRO' then 2
        when 'ENTERPRISE' then 3
        else 4
      end asc,
      t."updatedAt" desc,
      t.id desc
    limit 50
  `;
}

export async function readVendorDetailActiveAssessmentCount(
  vendorId: number,
): Promise<Array<{ count: number }>> {
  return prisma.$queryRaw<Array<{ count: number }>>`
    select count(*)::int as count
    from "AssessmentRun"
    where "vendorId" = ${vendorId}
      and status::text in (
        'DRAFT',
        'LAUNCHED',
        'IN_PROGRESS',
        'REVIEW_READY',
        'UNDER_REVIEW'
      )
  `;
}

export async function readVendorDetailAssessmentRegistry(
  vendorId: number,
): Promise<VendorDetailAssessmentRegistryRow[]> {
  return prisma.$queryRaw<VendorDetailAssessmentRegistryRow[]>`
    select
      ra.id::int as "assignmentId",
      null::int as "assessmentRunId",
      ra.status::text as status,
      ra."assignmentType"::text as "assignmentType",
      coalesce(resp.responses->>'releaseState', '') as "releaseState",
      coalesce(resp.responses->>'intent', '') as intent,
      coalesce(
        resp.responses->>'riskLevel',
        resp.responses->'governanceReleaseSnapshot'->>'riskLevel'
      ) as "riskLevel",
      coalesce(
        resp.responses->>'decision',
        resp.responses->'governanceReleaseSnapshot'->>'decision'
      ) as decision,
      ra."reviewerUserId",
      ra."reviewerName",
      ra."createdAt",
      ra."updatedAt",
      coalesce(
        resp.responses->>'releasedAt',
        resp.responses->'governanceReleaseSnapshot'->>'releasedAt'
      ) as "releasedAt",
      coalesce(
        resp.responses->>'confirmedAt',
        resp.responses->'governanceReleaseSnapshot'->>'confirmedAt'
      ) as "confirmedAt",
      coalesce(
        resp.responses->'governanceSeal'->>'checksum',
        resp.responses
          ->'governanceReleaseSnapshot'
          ->'governanceSeal'
          ->>'checksum'
      ) as checksum,
      gm.id::int as "manifestId"
    from "ReviewAssignment" ra
    left join "ReviewRequest" rr
      on rr.id = ra."reviewRequestId"
    left join lateral (
      select
        r.id,
        r.responses,
        r."updatedAt"
      from "ReviewResponse" r
      where r."reviewAssignmentId" = ra.id
      order by r."updatedAt" desc, r.id desc
      limit 1
    ) resp on true
    left join "GovernanceReleaseManifest" gm
      on gm."reviewResponseId" = resp.id
    where coalesce(
      rr."vendorId",
      ra."vendorId"
    ) = ${vendorId}
    order by ra."updatedAt" desc, ra.id desc
    limit 50
  `;
}

export async function readVendorDetailGovernanceMetrics(
  vendorId: number,
): Promise<VendorDetailGovernanceMetricRow[]> {
  return prisma.$queryRaw<VendorDetailGovernanceMetricRow[]>`
    with review_rows as (
      select
        ra.id,
        ra.status::text as status,
        ra."assignmentType"::text as "assignmentType",
        latest.responses
      from "ReviewAssignment" ra
      left join "ReviewRequest" req
        on req.id = ra."reviewRequestId"
      left join lateral (
        select r.responses
        from "ReviewResponse" r
        where r."reviewAssignmentId" = ra.id
        order by r."updatedAt" desc, r.id desc
        limit 1
      ) latest on true
      where coalesce(
        req."vendorId",
        ra."vendorId"
      ) = ${vendorId}
        and ra.status::text not in (
          'ARCHIVED',
          'CANCELLED',
          'CANCELED'
        )
        and latest.responses is not null
        and coalesce(
          latest.responses->>'releaseState',
          ''
        ) not in (
          'ARCHIVED',
          'CANCELLED',
          'CANCELED',
          'RELEASED',
          'CONFIRMED'
        )
    ),
    finding_rows as (
      select
        jsonb_array_length(
          case
            when jsonb_typeof(
              responses->'truvernReviewerIntelligence'->'findings'
            ) = 'array'
              then responses->'truvernReviewerIntelligence'->'findings'
            when jsonb_typeof(
              responses->'governanceReleaseSnapshot'->'findingsSnapshot'
            ) = 'array'
              then responses->'governanceReleaseSnapshot'->'findingsSnapshot'
            when jsonb_typeof(responses->'findings') = 'array'
              then responses->'findings'
            else '[]'::jsonb
          end
        ) as finding_count
      from review_rows
      where responses is not null
    )
    select
      (
        select count(*)::int
        from "Evidence"
        where "vendorId" = ${vendorId}
      ) as "evidenceCount",
      (
        select count(*)::int
        from "EvidenceRequest"
        where "vendorId" = ${vendorId}
      ) as "evidenceRequestCount",
      (
        (
          select count(*)::int
          from review_rows
          where status in (
            'UNDER REVIEW',
            'IN_PROGRESS',
            'SUBMITTED',
            'REVIEW_READY',
            'LAUNCHED'
          )
            and coalesce(
              responses->>'releaseState',
              ''
            ) not in (
              'RELEASED',
              'CONFIRMED',
              'ARCHIVED',
              'CANCELLED',
              'CANCELED'
            )
        )
        +
        (
          select count(*)::int
          from "Assessment"
          where "vendorId" = ${vendorId}
            and status::text in (
              'DRAFT',
              'LAUNCHED',
              'IN_PROGRESS',
              'REVIEW_READY',
              'UNDER_REVIEW',
              'SUBMITTED'
            )
            and token is not null
        )
      ) as "activeReviewCount",
      coalesce(
        (
          select sum(finding_count)::int
          from finding_rows
        ),
        0
      ) as "issueCount"
  `;
}