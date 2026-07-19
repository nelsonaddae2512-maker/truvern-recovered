const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const TEMPLATE_ID = 71;
const FRAMEWORK_SLUG = "nist-800-53-rev5";

function familyCode(title) {
  const match = String(title || "").match(/^([A-Z]{2})\s*[—-]/);
  return match ? match[1] : "GV";
}

async function main() {
  const framework = await prisma.truvernFramework.findUnique({
    where: { slug: FRAMEWORK_SLUG },
  });

  if (!framework) throw new Error(`Framework not found: ${FRAMEWORK_SLUG}`);

  const sections = await prisma.assessmentSection.findMany({
    where: { templateId: TEMPLATE_ID },
    include: {
      questions: {
        orderBy: [{ orderIndex: "asc" }, { id: "asc" }],
      },
    },
    orderBy: [{ order: "asc" }, { id: "asc" }],
  });

  await prisma.$transaction(
    async (tx) => {
      await tx.truvernAssessmentResponse.deleteMany({
        where: { assessment: { frameworkId: framework.id } },
      });

      await tx.truvernControlQuestion.deleteMany({
        where: { control: { frameworkId: framework.id } },
      });

      await tx.truvernControl.deleteMany({
        where: { frameworkId: framework.id },
      });

      for (const section of sections) {
        const code = familyCode(section.title);

        const control = await tx.truvernControl.create({
          data: {
            frameworkId: framework.id,
            controlId: code,
            family: code,
            title: section.title,
            description: section.description,
            sortOrder: section.order ?? 0,
          },
        });

        await tx.truvernControlQuestion.createMany({
          data: section.questions.map((question) => ({
            controlId: control.id,
            prompt: question.text,
            helpText:
              question.helpText ||
              question.description ||
              `Provide a governance response for ${section.title}.`,
            evidencePrompt:
              "Upload or reference policies, screenshots, exports, reports, attestations, certifications, tickets, or other evidence that supports this response.",
            weight: Number(question.weight ?? 1),
            requiresEvidence: true,
            requiresAttestation: false,
            sortOrder: question.orderIndex ?? question.id,
            metadata: {
              source: "AssessmentTemplate",
              sourceTemplateId: TEMPLATE_ID,
              sourceSectionId: section.id,
              sourceQuestionId: question.id,
              sourceQuestionType: question.type,
              sourceCategory: question.category,
              required: Boolean(question.required),
            },
          })),
        });
      }
    },
    {
      maxWait: 20000,
      timeout: 120000,
    },
  );

  const refreshed = await prisma.truvernFramework.findUnique({
    where: { id: framework.id },
    include: { controls: { include: { questions: true } } },
  });

  console.log({
    frameworkId: refreshed.id,
    slug: refreshed.slug,
    controls: refreshed.controls.length,
    questions: refreshed.controls.reduce(
      (sum, control) => sum + control.questions.length,
      0,
    ),
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
