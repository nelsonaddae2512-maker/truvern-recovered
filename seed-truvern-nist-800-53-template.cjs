const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const families = [
  ["AC", "Access Control"],
  ["AT", "Awareness and Training"],
  ["AU", "Audit and Accountability"],
  ["CA", "Assessment, Authorization, and Monitoring"],
  ["CM", "Configuration Management"],
  ["CP", "Contingency Planning"],
  ["IA", "Identification and Authentication"],
  ["IR", "Incident Response"],
  ["MA", "Maintenance"],
  ["MP", "Media Protection"],
  ["PE", "Physical and Environmental Protection"],
  ["PL", "Planning"],
  ["PM", "Program Management"],
  ["PS", "Personnel Security"],
  ["PT", "PII Processing and Transparency"],
  ["RA", "Risk Assessment"],
  ["SA", "System and Services Acquisition"],
  ["SC", "System and Communications Protection"],
  ["SI", "System and Information Integrity"],
  ["SR", "Supply Chain Risk Management"],
];

const questionsPerFamily = 6;

async function main() {
  const templateName = "Truvern NIST 800-53 Governance Review";

  const existing = await prisma.assessmentTemplate.findFirst({
    where: { name: templateName },
    include: {
      sections: {
        include: { questions: true },
      },
    },
  });

  if (existing) {
    const questionCount = existing.sections.reduce(
      (sum, section) => sum + section.questions.length,
      0,
    );

    console.log(`Template already exists: ${existing.id}, questions=${questionCount}`);

    if (questionCount !== 120 || !existing.isActive) {
      await prisma.assessmentTemplate.update({
        where: { id: existing.id },
        data: { isActive: true },
      });
    }

    return;
  }

  const template = await prisma.assessmentTemplate.create({
    data: {
      name: templateName,
      description:
        "Truvern-managed NIST SP 800-53 vendor governance review template for expert review, findings, remediation, attestations, and release readiness.",
      standard: "NIST SP 800-53",
      category: "Governance",
      version: "1.0",
      status: "ACTIVE",
      isActive: true,
      sections: {
        create: families.map(([code, title], familyIndex) => ({
          title: `${code} - ${title}`,
          description: `Governance review controls for ${title}.`,
          order: familyIndex + 1,
          questions: {
            create: Array.from({ length: questionsPerFamily }).map((_, idx) => {
              const n = idx + 1;
              return {
                text: `${code}-${String(n).padStart(2, "0")}: Describe how your organization governs, implements, monitors, and evidences ${title.toLowerCase()} control activities for this vendor service.`,
                type: "LONG_TEXT",
                required: true,
                order: n,
                metadata: {
                  framework: "NIST SP 800-53",
                  family: code,
                  familyName: title,
                  controlRef: `${code}-${String(n).padStart(2, "0")}`,
                  truvernManagedReview: true,
                },
              };
            }),
          },
        })),
      },
    },
    include: {
      sections: {
        include: { questions: true },
      },
    },
  });

  const count = template.sections.reduce(
    (sum, section) => sum + section.questions.length,
    0,
  );

  console.log(`Created template ${template.id}: ${template.name}`);
  console.log(`Question count: ${count}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
