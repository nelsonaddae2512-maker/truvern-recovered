import prisma from "@/lib/prisma";

export type AssessmentCatalogTemplateRow = {
  id: number;
  name: string;
  description: string | null;
  standard: string | null;
  category: string | null;
  version: string | null;
  accessTier: string | null;
  catalogKey: string | null;
  isFeatured: boolean;
  sectionCount: number;
  questionCount: number;
  isActive?: boolean | null;
  assessmentCount?: number | null;
  runCount?: number | null;
};

export async function readSystemAssessmentCatalogTemplates(): Promise<
  AssessmentCatalogTemplateRow[]
> {
  return prisma.$queryRaw<AssessmentCatalogTemplateRow[]>`
    select
      t.id,
      t.name,
      t.description,
      t.standard,
      t.category,
      t.version,
      t."accessTier"::text as "accessTier",
      t."catalogKey",
      t."isFeatured",
      coalesce(count(distinct s.id), 0)::int as "sectionCount",
      coalesce(count(distinct q.id), 0)::int as "questionCount"
    from "AssessmentTemplate" t
    left join "AssessmentSection" s
      on s."templateId" = t.id
    left join "AssessmentQuestion" q
      on q."templateId" = t.id
    where t."isActive" = true
      and t.source = 'SYSTEM'::"TemplateSource"
    group by t.id
    order by
      t."isFeatured" desc,
      t."updatedAt" desc,
      t.id desc
    limit 24
  `;
}

export async function readCustomAssessmentCatalogTemplates(
  organizationId: number,
): Promise<AssessmentCatalogTemplateRow[]> {
  return prisma.$queryRaw<AssessmentCatalogTemplateRow[]>`
    select
      t.id,
      t.name,
      t.description,
      t.standard,
      t.category,
      t.version,
      null::text as "accessTier",
      null::text as "catalogKey",
      false as "isFeatured",
      t."isActive",
      coalesce(count(distinct s.id), 0)::int as "sectionCount",
      coalesce(count(distinct q.id), 0)::int as "questionCount",
      coalesce(count(distinct a.id), 0)::int as "assessmentCount",
      coalesce(count(distinct r.id), 0)::int as "runCount"
    from "AssessmentTemplate" t
    left join "AssessmentSection" s
      on s."templateId" = t.id
    left join "AssessmentQuestion" q
      on q."templateId" = t.id
    left join "Assessment" a
      on a."templateId" = t.id
    left join "AssessmentRun" r
      on r."templateId" = t.id
    where t.source = 'CUSTOM'::"TemplateSource"
      and t."organizationId" = ${organizationId}
    group by t.id
    order by
      t."updatedAt" desc,
      t.id desc
    limit 25
  `;
}
