const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const QUESTION_TYPE = "YES_NO";

const sectionsByTemplate = {
  "truvern-baseline": [
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
        "Do you restrict production data access to authorized personnel?",
        "Do you maintain documented data retention procedures?"
      ]
    },
    {
      title: "Incident readiness",
      description: "Checks basic security incident response maturity.",
      questions: [
        "Do you maintain an incident response plan?",
        "Do you test or review the incident process at least annually?",
        "Do you notify customers of material incidents within defined timelines?",
        "Do you track and remediate incident follow-up actions?"
      ]
    }
  ],

  "vendor-intake-lite": [
    {
      title: "Vendor profile",
      description: "Captures core vendor and service context.",
      questions: [
        "Does the vendor provide a clearly documented service description?",
        "Will the vendor process customer, employee, or regulated data?",
        "Is the vendor business-critical to operations?",
        "Does the vendor use subprocessors to deliver the service?"
      ]
    },
    {
      title: "Security basics",
      description: "Screens for minimum security practices.",
      questions: [
        "Does the vendor enforce MFA for administrative users?",
        "Does the vendor maintain security policies?",
        "Does the vendor conduct employee security awareness training?",
        "Does the vendor have a vulnerability management process?"
      ]
    },
    {
      title: "Evidence readiness",
      description: "Determines whether evidence is available for review.",
      questions: [
        "Can the vendor provide a current security attestation or certification?",
        "Can the vendor provide a privacy or data processing addendum?",
        "Can the vendor provide incident response documentation?",
        "Can the vendor provide business continuity documentation?"
      ]
    }
  ],

  "security-basics": [
    {
      title: "Security governance",
      description: "Confirms baseline security ownership and policy controls.",
      questions: [
        "Is there an assigned owner for security governance?",
        "Are security policies reviewed at least annually?",
        "Are employees required to complete security training?",
        "Are security exceptions tracked and approved?"
      ]
    },
    {
      title: "Technical controls",
      description: "Reviews common preventive safeguards.",
      questions: [
        "Is MFA enforced for business-critical systems?",
        "Are endpoints protected with managed security tooling?",
        "Are vulnerabilities tracked through remediation?",
        "Are backups protected from unauthorized modification?"
      ]
    },
    {
      title: "Operational resilience",
      description: "Checks preparedness for service disruption.",
      questions: [
        "Do you maintain backup and recovery procedures?",
        "Are critical systems monitored for availability?",
        "Do you maintain a business continuity plan?",
        "Do you test recovery procedures periodically?"
      ]
    }
  ],

  "sig-lite": [
    {
      title: "Governance and risk",
      description: "SIG-aligned governance controls for vendor risk management.",
      questions: [
        "Do you maintain a formal information security program?",
        "Do you perform enterprise risk assessments at least annually?",
        "Do you maintain documented policies and standards?",
        "Do you track remediation of control gaps?"
      ]
    },
    {
      title: "Privacy and data protection",
      description: "Evaluates privacy, confidentiality, and data handling controls.",
      questions: [
        "Do you maintain a data inventory or processing register?",
        "Do you apply least-privilege access to sensitive data?",
        "Do you encrypt sensitive data at rest and in transit?",
        "Do you maintain breach notification procedures?"
      ]
    },
    {
      title: "Third-party and resilience",
      description: "Reviews subprocessors and operational continuity.",
      questions: [
        "Do you assess critical subprocessors before onboarding?",
        "Do you monitor critical third-party service providers?",
        "Do you maintain business continuity and disaster recovery plans?",
        "Do you test continuity or recovery plans at least annually?"
      ]
    }
  ],

  "soc2-core": [
    {
      title: "Security criteria",
      description: "SOC 2-aligned controls for access, change, and monitoring.",
      questions: [
        "Do you enforce MFA for administrative access?",
        "Are logical access rights approved and reviewed?",
        "Are production changes reviewed before deployment?",
        "Do you monitor systems for security events?"
      ]
    },
    {
      title: "Availability and resilience",
      description: "Controls supporting service availability and recovery.",
      questions: [
        "Do you define uptime or availability objectives?",
        "Are backups performed and monitored?",
        "Are recovery procedures tested periodically?",
        "Do you maintain incident and outage communication procedures?"
      ]
    },
    {
      title: "Vendor and confidentiality controls",
      description: "Controls over confidential data and vendors.",
      questions: [
        "Do you restrict confidential data access by role?",
        "Do you review vendors that support the service?",
        "Do you require confidentiality commitments from personnel?",
        "Do you maintain customer data disposal procedures?"
      ]
    }
  ],

  "iso27001-lite": [
    {
      title: "ISMS governance",
      description: "ISO 27001-aligned governance and ownership checks.",
      questions: [
        "Is information security governance formally assigned?",
        "Are information security risks documented and reviewed?",
        "Are information security policies approved and maintained?",
        "Are corrective actions tracked to closure?"
      ]
    },
    {
      title: "Asset and access control",
      description: "Reviews asset ownership and access management.",
      questions: [
        "Are information assets inventoried and assigned owners?",
        "Are access rights provisioned through approval workflows?",
        "Are privileged access rights reviewed periodically?",
        "Are authentication controls enforced for critical systems?"
      ]
    },
    {
      title: "Operations and improvement",
      description: "Checks operational control monitoring and improvement.",
      questions: [
        "Are security events logged and reviewed?",
        "Are vulnerabilities identified and remediated?",
        "Are continuity arrangements defined and tested?",
        "Are internal reviews or audits performed periodically?"
      ]
    }
  ],

  "full-sig": [
    {
      title: "Enterprise governance",
      description: "Broad governance controls for critical vendor review.",
      questions: [
        "Do you maintain an enterprise-wide security governance program?",
        "Are risk assessments performed across critical business processes?",
        "Are policies mapped to regulatory and contractual obligations?",
        "Are board or executive stakeholders informed of material risks?"
      ]
    },
    {
      title: "Security and privacy control maturity",
      description: "Assesses control implementation across security and privacy domains.",
      questions: [
        "Are technical controls tested for effectiveness?",
        "Are privacy controls mapped to data processing activities?",
        "Are control exceptions tracked with accountable owners?",
        "Are remediation plans monitored through completion?"
      ]
    },
    {
      title: "Critical vendor resilience",
      description: "Reviews resilience, concentration, and subcontractor risk.",
      questions: [
        "Are critical dependencies identified and risk-rated?",
        "Are subprocessors monitored for security and continuity risk?",
        "Are recovery objectives defined for critical services?",
        "Are resilience tests documented and reviewed?"
      ]
    }
  ],

  "hipaa": [
    {
      title: "HIPAA administrative safeguards",
      description: "Reviews administrative safeguards for protected health information.",
      questions: [
        "Is there an assigned HIPAA security or privacy owner?",
        "Are workforce members trained on PHI handling?",
        "Are access rights to PHI reviewed periodically?",
        "Are security incidents involving PHI documented and investigated?"
      ]
    },
    {
      title: "HIPAA technical safeguards",
      description: "Checks access, audit, integrity, and transmission protections.",
      questions: [
        "Is unique user identification enforced for PHI systems?",
        "Are PHI system access logs maintained and reviewed?",
        "Are integrity controls used to protect PHI from improper alteration?",
        "Is ePHI encrypted or otherwise protected during transmission?"
      ]
    },
    {
      title: "Business associate readiness",
      description: "Validates vendor readiness for healthcare data relationships.",
      questions: [
        "Can the vendor support a Business Associate Agreement?",
        "Are subcontractors handling PHI subject to equivalent safeguards?",
        "Are breach notification timelines documented?",
        "Are PHI disposal procedures documented?"
      ]
    }
  ],

  "pci-dss": [
    {
      title: "Cardholder data environment",
      description: "Identifies PCI scope and data protection practices.",
      questions: [
        "Does the vendor store, process, or transmit cardholder data?",
        "Is cardholder data encrypted in transit and at rest?",
        "Is access to cardholder data restricted by business need?",
        "Is the cardholder data environment segmented where applicable?"
      ]
    },
    {
      title: "PCI security controls",
      description: "Checks core PCI DSS security practices.",
      questions: [
        "Are vulnerability scans performed on in-scope systems?",
        "Are secure configuration standards maintained?",
        "Is MFA enforced for administrative access?",
        "Are security logs reviewed for in-scope systems?"
      ]
    },
    {
      title: "PCI evidence",
      description: "Confirms availability of PCI compliance evidence.",
      questions: [
        "Can the vendor provide an Attestation of Compliance?",
        "Can the vendor provide recent vulnerability scan evidence?",
        "Can the vendor provide penetration test evidence where applicable?",
        "Are PCI responsibilities documented between parties?"
      ]
    }
  ],

  "ffiec": [
    {
      title: "Financial services governance",
      description: "Vendor governance controls aligned to financial institution expectations.",
      questions: [
        "Is the service classified by criticality and risk?",
        "Are security and operational risks reviewed by management?",
        "Are regulatory obligations documented for the service?",
        "Are vendor performance and risk indicators monitored?"
      ]
    },
    {
      title: "Operational resilience",
      description: "Reviews continuity, availability, and dependency risk.",
      questions: [
        "Are recovery time and recovery point objectives defined?",
        "Are business continuity plans tested periodically?",
        "Are incident communication procedures documented?",
        "Are concentration risks and critical dependencies reviewed?"
      ]
    },
    {
      title: "Audit and oversight",
      description: "Checks evidence, auditability, and ongoing oversight.",
      questions: [
        "Can the vendor provide independent assurance reports?",
        "Are audit findings tracked through remediation?",
        "Are access and activity logs retained for review?",
        "Are material changes communicated to customers?"
      ]
    }
  ]
};

async function getEnumQuestionType() {
  const rows = await prisma.$queryRawUnsafe(`
    select enumlabel
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'QuestionType'
    order by enumsortorder
  `);

  const labels = rows.map((row) => row.enumlabel);
  return labels.includes(QUESTION_TYPE) ? QUESTION_TYPE : labels[0] || "TEXT";
}

async function main() {
  const questionType = await getEnumQuestionType();

  const templates = await prisma.$queryRawUnsafe(`
    select id, "catalogKey"
    from "AssessmentTemplate"
    where source = 'SYSTEM'::"TemplateSource"
      and origin = 'CATALOG'::"TemplateOrigin"
      and "isActive" = true
    order by id asc
  `);

  for (const template of templates) {
    const catalogKey = template.catalogKey;
    const blueprint = sectionsByTemplate[catalogKey];

    if (!blueprint) {
      console.log("No blueprint for", catalogKey);
      continue;
    }

    const [{ count }] = await prisma.$queryRawUnsafe(
      `
      select count(*)::int as count
      from "AssessmentQuestion"
      where "templateId" = $1
      `,
      template.id,
    );

    if (count > 0) {
      console.log("Skipping existing questionnaire:", catalogKey, count);
      continue;
    }

    for (let sectionIndex = 0; sectionIndex < blueprint.length; sectionIndex++) {
      const section = blueprint[sectionIndex];

      const [createdSection] = await prisma.$queryRawUnsafe(
        `
        insert into "AssessmentSection"
          ("templateId", title, description, "order")
        values
          ($1, $2, $3, $4)
        returning id
        `,
        template.id,
        section.title,
        section.description,
        sectionIndex + 1,
      );

      for (let questionIndex = 0; questionIndex < section.questions.length; questionIndex++) {
        await prisma.$executeRawUnsafe(
          `
          insert into "AssessmentQuestion"
            ("templateId", "sectionId", text, type, required, "orderIndex")
          values
            ($1, $2, $3, $4::"QuestionType", true, $5)
          `,
          template.id,
          createdSection.id,
          section.questions[questionIndex],
          questionType,
          questionIndex + 1,
        );
      }
    }

    console.log("Seeded questionnaire:", catalogKey);
  }

  const rows = await prisma.$queryRawUnsafe(`
    select
      t.id,
      t.name,
      t."catalogKey",
      t."accessTier"::text as "accessTier",
      count(distinct s.id)::int as sections,
      count(q.id)::int as questions
    from "AssessmentTemplate" t
    left join "AssessmentSection" s on s."templateId" = t.id
    left join "AssessmentQuestion" q on q."templateId" = t.id
    where t.source = 'SYSTEM'::"TemplateSource"
    group by t.id, t.name, t."catalogKey", t."accessTier"
    order by t.id asc
  `);

  console.dir(rows, { depth: null });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());


