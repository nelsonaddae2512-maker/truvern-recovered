import prisma from "@/lib/prisma";

export type AssessmentLaunchTemplateRow = {
  id: number;
  name: string;
  accessTier: string | null;
  source: string | null;
  origin: string | null;
  isSystem: boolean;
  isActive: boolean;
};

export async function readAssessmentLaunchTemplate(
  templateId: number,
): Promise<AssessmentLaunchTemplateRow[]> {
  return prisma.$queryRaw<AssessmentLaunchTemplateRow[]>`
    select
      id,
      name,
      "accessTier"::text as "accessTier",
      source::text as source,
      origin::text as origin,
      "isSystem",
      "isActive"
    from "AssessmentTemplate"
    where id = ${templateId}
    limit 1
  `;
}

export async function insertAssessmentLaunchRun(input: {
  organizationId: number;
  vendorId: number;
  assessmentId: number;
  templateId: number;
  startedAt: Date;
}): Promise<Array<{ id: number }>> {
  return prisma.$queryRaw<Array<{ id: number }>>`
    insert into "AssessmentRun" (
      "organizationId",
      "vendorId",
      "assessmentId",
      "templateId",
      "status",
      "startedAt",
      "createdAt",
      "updatedAt"
    )
    values (
      ${input.organizationId},
      ${input.vendorId},
      ${input.assessmentId},
      ${input.templateId},
      'LAUNCHED'::"AssessmentStatus",
      ${input.startedAt},
      ${input.startedAt},
      ${input.startedAt}
    )
    returning "id"
  `;
}