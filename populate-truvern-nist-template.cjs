const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const template = await prisma.assessmentTemplate.findFirst({
    where: { name: "Truvern NIST 800-53 Governance Review" },
    select: { id: true, name: true },
  });

  if (!template) throw new Error("Template not found.");

  await prisma.assessmentQuestion.deleteMany({
    where: { templateId: template.id },
  });

  await prisma.assessmentSection.deleteMany({
    where: { templateId: template.id },
  });

  const sections = [
    ["Access Control", [
      "Describe privileged access management controls.",
      "How are user access reviews performed?",
      "Describe MFA enforcement for administrative accounts.",
    ]],
    ["Incident Response", [
      "Describe incident response escalation workflows.",
      "How are incidents classified and tracked?",
      "Provide evidence of incident response testing.",
    ]],
    ["Risk Management", [
      "Describe third-party risk governance.",
      "How are security risks tracked and remediated?",
      "Provide evidence of risk register reviews.",
    ]],
    ["System & Communications Protection", [
      "Describe network segmentation controls.",
      "Describe encryption standards in use.",
      "Provide evidence of secure communications controls.",
    ]],
    ["Audit & Accountability", [
      "Describe centralized logging architecture.",
      "How are audit logs protected?",
      "Describe SIEM retention and monitoring.",
    ]],
  ];

  for (let i = 0; i < sections.length; i++) {
    const [title, questions] = sections[i];

    const section = await prisma.assessmentSection.create({
      data: {
        templateId: template.id,
        title,
        description: `${title} governance review controls`,
        order: i + 1,
      },
    });

    for (let q = 0; q < questions.length; q++) {
      await prisma.assessmentQuestion.create({
        data: {
          templateId: template.id,
          sectionId: section.id,
          text: questions[q],
          type: "TEXT",
          required: true,
          orderIndex: q + 1,
        },
      });
    }
  }

  console.log("Template populated:", template.id, template.name);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
