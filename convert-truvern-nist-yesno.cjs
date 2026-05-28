const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

function toYesNo(text) {
  return text
    .replace(/^Describe /, "Is there a documented control that describes ")
    .replace(/^How are /, "Are ")
    .replace(/^How is /, "Is ")
    .replace(/^How often are /, "Are ")
    .replace(/^Which /, "Are defined ")
    .replace(/^What are /, "Are documented ")
    .replace(/^Provide evidence of /, "Is evidence available for ")
    .replace(/\.$/, "?");
}

async function main() {
  const template = await prisma.assessmentTemplate.findFirst({
    where: { name: "Truvern NIST 800-53 Governance Review" },
    select: { id: true },
  });

  if (!template) throw new Error("Template not found.");

  const questions = await prisma.assessmentQuestion.findMany({
    where: { templateId: template.id },
    orderBy: [{ sectionId: "asc" }, { orderIndex: "asc" }],
    select: { id: true, text: true },
  });

  for (const q of questions) {
    await prisma.assessmentQuestion.update({
      where: { id: q.id },
      data: {
        type: "YES_NO",
        text: toYesNo(q.text),
        required: true,
      },
    });
  }

  console.log(`Converted ${questions.length} questions to YES_NO.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
