import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";

type TemplateClient = Pick<
  Prisma.TransactionClient,
  "assessmentTemplate" | "assessmentQuestion"
>;

export type TruvernReviewTemplateSelection = {
  id: number;
  name: string;
  organizationId: number | null;
  source: string;
  isSystem: boolean;
  questionCount: number;
};

export async function readTruvernReviewTemplateSelection(
  input: {
    templateId: number;
    organizationId: number;
  },
  client: TemplateClient = prisma,
): Promise<TruvernReviewTemplateSelection | null> {
  const template =
    await client.assessmentTemplate.findFirst({
      where: {
        id: input.templateId,
        isActive: true,
        OR: [
          {
            organizationId: input.organizationId,
          },
          {
            isSystem: true,
          },
          {
            source: "SYSTEM",
          },
        ],
      },
      select: {
        id: true,
        name: true,
        organizationId: true,
        source: true,
        isSystem: true,
      },
    });

  if (!template) {
    return null;
  }

  const questionCount =
    await client.assessmentQuestion.count({
      where: {
        templateId: template.id,
      },
    });

  return {
    id: template.id,
    name: template.name,
    organizationId: template.organizationId,
    source: String(template.source),
    isSystem: template.isSystem,
    questionCount,
  };
}