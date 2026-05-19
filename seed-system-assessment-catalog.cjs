const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const SYSTEM_ORG_ID = 2;

async function upsertCatalogTemplate(template) {

  const rows = await prisma.$queryRawUnsafe(
    `
    select id
    from "AssessmentTemplate"
    where "catalogKey" = $1
    limit 1
    `,
    template.catalogKey,
  );

  const existing = rows?.[0];

  if (existing?.id) {

    await prisma.$executeRawUnsafe(
      `
      update "AssessmentTemplate"
      set
        name = $1,
        description = $2,
        category = $3,
        standard = $4,
        code = $5,
        version = '1.0',
        "isActive" = true,
        source = 'SYSTEM'::"TemplateSource",
        origin = 'CATALOG'::"TemplateOrigin",
        "accessTier" = $6::"TemplateAccessTier",
        "isSystem" = true,
        "isFeatured" = true,
        "catalogVersion" = '1.0',
        "updatedAt" = now()
      where id = $7
      `,
      template.name,
      template.description,
      template.category,
      template.standard,
      template.code,
      template.accessTier,
      existing.id,
    );

    return;
  }

  await prisma.$executeRawUnsafe(
    `
    insert into "AssessmentTemplate"
    (
      "organizationId",
      name,
      description,
      standard,
      category,
      code,
      version,
      "isActive",
      origin,
      source,
      "accessTier",
      "isSystem",
      "isFeatured",
      "catalogKey",
      "catalogVersion",
      "catalogInstalledAt",
      "createdAt",
      "updatedAt"
    )
    values
    (
      $1,
      $2,
      $3,
      $4,
      $5,
      $6,
      '1.0',
      true,
      'CATALOG'::"TemplateOrigin",
      'SYSTEM'::"TemplateSource",
      $7::"TemplateAccessTier",
      true,
      true,
      $8,
      '1.0',
      now(),
      now(),
      now()
    )
    `,
    SYSTEM_ORG_ID,
    template.name,
    template.description,
    template.standard,
    template.category,
    template.code,
    template.accessTier,
    template.catalogKey,
  );
}

async function main() {

  const templates = [

    {
      catalogKey: "truvern-baseline",
      code: "TRUVERN-BASELINE",
      name: "Truvern Baseline",
      description: "Core vendor governance baseline assessment.",
      category: "Governance",
      standard: "TRUVERN",
      accessTier: "FREE",
    },

    {
      catalogKey: "vendor-intake-lite",
      code: "VENDOR-INTAKE-LITE",
      name: "Vendor Intake Lite",
      description: "Fast lightweight vendor intake workflow.",
      category: "Vendor Intake",
      standard: "TRUVERN",
      accessTier: "FREE",
    },

    {
      catalogKey: "security-basics",
      code: "SECURITY-BASICS",
      name: "Security Basics",
      description: "Essential security control review.",
      category: "Security",
      standard: "TRUVERN",
      accessTier: "FREE",
    },

    {
      catalogKey: "sig-lite",
      code: "SIG-LITE",
      name: "SIG Lite",
      description: "Condensed SIG-aligned assessment.",
      category: "Security",
      standard: "SIG",
      accessTier: "PRO",
    },

    {
      catalogKey: "soc2-core",
      code: "SOC2-CORE",
      name: "SOC 2 Core",
      description: "SOC 2 governance readiness assessment.",
      category: "Compliance",
      standard: "SOC2",
      accessTier: "PRO",
    },

    {
      catalogKey: "iso27001-lite",
      code: "ISO27001-LITE",
      name: "ISO 27001 Lite",
      description: "ISO 27001 aligned readiness review.",
      category: "Compliance",
      standard: "ISO27001",
      accessTier: "PRO",
    },

    {
      catalogKey: "full-sig",
      code: "FULL-SIG",
      name: "Full SIG",
      description: "Full Shared Assessments SIG framework.",
      category: "Enterprise",
      standard: "SIG",
      accessTier: "ENTERPRISE",
    },

    {
      catalogKey: "hipaa",
      code: "HIPAA",
      name: "HIPAA Assessment",
      description: "Healthcare compliance assessment.",
      category: "Compliance",
      standard: "HIPAA",
      accessTier: "ENTERPRISE",
    },

    {
      catalogKey: "pci-dss",
      code: "PCI-DSS",
      name: "PCI DSS Assessment",
      description: "Payment security governance assessment.",
      category: "Compliance",
      standard: "PCI",
      accessTier: "ENTERPRISE",
    },

    {
      catalogKey: "ffiec",
      code: "FFIEC",
      name: "FFIEC Vendor Review",
      description: "Financial institution vendor governance review.",
      category: "Financial Services",
      standard: "FFIEC",
      accessTier: "ENTERPRISE",
    },

  ];

  for (const template of templates) {
    await upsertCatalogTemplate(template);
  }

  const results = await prisma.$queryRawUnsafe(`
    select
      id,
      name,
      "catalogKey",
      origin::text as origin,
      source::text as source,
      "accessTier"::text as "accessTier"
    from "AssessmentTemplate"
    where origin = 'CATALOG'::"TemplateOrigin"
    order by id asc
  `);

  console.dir(results, { depth: null });

  console.log("Catalog templates seeded successfully.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
