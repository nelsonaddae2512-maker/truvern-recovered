const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const packs = [
  {
    match: ["truvern starter", "baseline"],
    sections: [
      {
        title: "Access governance",
        description: "Validates identity, authentication, and access management posture.",
        questions: [
          "Does your organization require MFA for administrative access?",
          "Do you review user access at least quarterly?",
          "Do you promptly remove access for terminated users?",
          "Do privileged accounts have separate approval and monitoring?"
        ]
      },
      {
        title: "Data handling",
        description: "Confirms how customer and operational data is protected.",
        questions: [
          "Do you classify sensitive customer data?",
          "Is sensitive data encrypted in transit and at rest?",
          "Do you restrict access to customer data by role?",
          "Do you have a documented data retention and deletion process?"
        ]
      },
      {
        title: "Incident readiness",
        description: "Checks preparedness for security and operational incidents.",
        questions: [
          "Do you maintain a documented incident response plan?",
          "Have you tested the incident response process in the last 12 months?",
          "Do you notify customers of material security incidents?",
          "Do you track and remediate incident findings?"
        ]
      }
    ]
  },
  {
    match: ["soc 2"],
    sections: [
      {
        title: "Security controls",
        description: "SOC 2-aligned security governance and operating controls.",
        questions: [
          "Do you maintain a current SOC 2 Type II report or equivalent attestation?",
          "Are logical access controls formally documented and reviewed?",
          "Do you perform vulnerability scanning on production systems?",
          "Are security exceptions tracked through remediation?"
        ]
      },
      {
        title: "Availability and resilience",
        description: "Evaluates service availability, continuity, and recovery practices.",
        questions: [
          "Do you maintain a documented business continuity plan?",
          "Do you maintain a disaster recovery plan with recovery objectives?",
          "Are backups tested periodically?",
          "Do you monitor production availability and service degradation?"
        ]
      },
      {
        title: "Vendor and subprocessors",
        description: "Assesses third-party dependencies supporting service delivery.",
        questions: [
          "Do you maintain a current list of subprocessors?",
          "Are critical third parties reviewed before onboarding?",
          "Do contracts require confidentiality and security obligations?",
          "Do you monitor material vendor risk on a recurring basis?"
        ]
      }
    ]
  },
  {
    match: ["sig"],
    sections: [
      {
        title: "Governance and risk management",
        description: "Shared assessment-style vendor risk governance baseline.",
        questions: [
          "Do you maintain a formal information security program?",
          "Is executive ownership assigned for security and risk management?",
          "Do you conduct periodic risk assessments?",
          "Are policies reviewed and approved at least annually?"
        ]
      },
      {
        title: "Privacy and compliance",
        description: "Validates privacy, regulatory, and customer data controls.",
        questions: [
          "Do you maintain a privacy policy covering customer data use?",
          "Do you support data subject rights where applicable?",
          "Do you maintain records of processing activities?",
          "Do you require privacy and security training for personnel?"
        ]
      },
      {
        title: "Technical safeguards",
        description: "Checks technical controls used to protect systems and data.",
        questions: [
          "Is production access logged and monitored?",
          "Do you enforce secure configuration standards?",
          "Do you patch critical vulnerabilities within defined SLAs?",
          "Do you use endpoint protection on managed devices?"
        ]
      }
    ]
  },
  {
    match: ["pci"],
    sections: [
      {
        title: "Cardholder data environment",
        description: "Payment security and cardholder data handling posture.",
        questions: [
          "Do you store, process, or transmit cardholder data?",
          "Is the cardholder data environment segmented from other systems?",
          "Do you maintain PCI DSS compliance evidence?",
          "Are payment system access privileges reviewed regularly?"
        ]
      },
      {
        title: "Monitoring and vulnerability management",
        description: "PCI-aligned monitoring, patching, and security testing.",
        questions: [
          "Do you perform vulnerability scans on payment systems?",
          "Are critical payment vulnerabilities remediated under defined SLAs?",
          "Are payment system logs retained and reviewed?",
          "Do you perform penetration testing where required?"
        ]
      }
    ]
  },
  {
    match: ["privacy", "data"],
    sections: [
      {
        title: "Privacy governance",
        description: "Privacy program, data processing, and contractual controls.",
        questions: [
          "Do you maintain a documented privacy program?",
          "Do you execute DPAs where customer personal data is processed?",
          "Do you maintain a subprocessors list?",
          "Do you support customer audit or assurance requests?"
        ]
      },
      {
        title: "Personal data protection",
        description: "Controls for protecting personal and sensitive data.",
        questions: [
          "Is personal data encrypted in transit and at rest?",
          "Is access to personal data limited by role?",
          "Do you have a deletion process for customer personal data?",
          "Do you notify customers of personal data incidents?"
        ]
      }
    ]
  }
];

function matchesTemplate(name, pack) {
  const normalized = name.toLowerCase();
  return pack.match.some((term) => normalized.includes(term));
}

async function main() {
  const templates = await prisma.assessmentTemplate.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      standard: true,
      category: true,
      _count: { select: { sections: true, questions: true } }
    },
    orderBy: { id: "asc" }
  });

  let seeded = 0;

  for (const template of templates) {
    if (template._count.sections > 0 || template._count.questions > 0) continue;

    const label = `${template.name} ${template.standard || ""} ${template.category || ""}`;
    const pack =
      packs.find((candidate) => matchesTemplate(label, candidate)) ||
      packs[0];

    for (const [sectionIndex, section] of pack.sections.entries()) {
      const createdSection = await prisma.assessmentSection.create({
        data: {
          templateId: template.id,
          title: section.title,
          description: section.description,
          order: sectionIndex + 1,
          weight: Math.round(100 / pack.sections.length)
        },
        select: { id: true }
      });

      for (const [questionIndex, question] of section.questions.entries()) {
        await prisma.assessmentQuestion.create({
          data: {
            templateId: template.id,
            sectionId: createdSection.id,
            orderIndex: questionIndex + 1,
            text: question,
            helpText: "Provide a short explanation and attach evidence where available.",
            type: "YES_NO",
            richType: "YES_NO",
            required: true,
            weight: 5
          }
        });
      }
    }

    seeded += 1;
    console.log(`Seeded ${template.name}`);
  }

  console.log(`Done. Seeded ${seeded} templates.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
