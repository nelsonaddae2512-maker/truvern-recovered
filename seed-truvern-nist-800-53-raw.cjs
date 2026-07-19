const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const families = [
  ["AC", "Access Control"],
  ["AT", "Awareness and Training"],
  ["AU", "Audit and Accountability"],
  ["CA", "Assessment Authorization and Monitoring"],
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

async function main() {
  const name = "Truvern NIST 800-53 Governance Review";

  await prisma.$transaction(async (tx) => {
    const existing = await tx.$queryRawUnsafe(
      `select id from "AssessmentTemplate" where name = $1 limit 1`,
      name,
    );

    let templateId;

    if (existing.length > 0) {
      templateId = existing[0].id;

      await tx.$executeRawUnsafe(
        `
        delete from "AssessmentQuestion"
        where "templateId" = $1
           or "sectionId" in (
             select id from "AssessmentSection" where "templateId" = $1
           )
        `,
        templateId,
      );

      await tx.$executeRawUnsafe(
        `delete from "AssessmentSection" where "templateId" = $1`,
        templateId,
      );

      await tx.$executeRawUnsafe(
        `
        update "AssessmentTemplate"
        set
          description = 'Truvern-managed NIST SP 800-53 vendor governance review template.',
          standard = 'NIST SP 800-53',
          code = 'TRV-NIST-800-53-GOV',
          category = 'Governance',
          version = '1.0',
          "isActive" = true,
          "isSystem" = true,
          "isFeatured" = true,
          "catalogKey" = 'truvern-nist-800-53-governance-review',
          origin = 'TRUVERN'
        where id = $1
        `,
        templateId,
      );
    } else {
      await tx.$executeRawUnsafe(
        `
        insert into "AssessmentTemplate" (
          "organizationId",
          name,
          description,
          standard,
          code,
          category,
          version,
          "isActive",
          "isSystem",
          "isFeatured",
          "catalogKey",
          origin,
          "createdAt",
          "updatedAt"
        )
        values (
          null,
          $1,
          'Truvern-managed NIST SP 800-53 vendor governance review template.',
          'NIST SP 800-53',
          'TRV-NIST-800-53-GOV',
          'Governance',
          '1.0',
          true,
          true,
          true,
          'truvern-nist-800-53-governance-review',
          'TRUVERN',
          now(),
          now()
        )
        `,
        name,
      );

      const rows = await tx.$queryRawUnsafe(
        `select id from "AssessmentTemplate" where name = $1 limit 1`,
        name,
      );

      templateId = rows[0].id;
    }

    for (let f = 0; f < families.length; f++) {
      const [code, title] = families[f];

      await tx.$executeRawUnsafe(
        `
        insert into "AssessmentSection" (
          "templateId",
          title,
          description,
          "order",
          weight
        )
        values ($1, $2, $3, $4, 1)
        `,
        templateId,
        `${code} - ${title}`,
        `Governance controls for ${title}.`,
        f + 1,
      );

      const sectionRows = await tx.$queryRawUnsafe(
        `
        select id from "AssessmentSection"
        where "templateId" = $1 and title = $2
        order by id desc
        limit 1
        `,
        templateId,
        `${code} - ${title}`,
      );

      const sectionId = sectionRows[0].id;

      for (let q = 1; q <= 6; q++) {
        const controlRef = `${code}-${String(q).padStart(2, "0")}`;
        const orderIndex = f * 6 + q;

        await tx.$executeRawUnsafe(
          `
          insert into "AssessmentQuestion" (
            "templateId",
            "sectionId",
            "orderIndex",
            text,
            "helpText",
            description,
            category,
            type,
            "richType",
            required,
            weight,
            key,
            options,
            "createdAt",
            "updatedAt"
          )
          values (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7,
            'TEXT',
            'TEXT',
            true,
            1,
            $8,
            '[]'::jsonb,
            now(),
            now()
          )
          `,
          templateId,
          sectionId,
          orderIndex,
          `${controlRef}: Describe how your organization governs, implements, monitors, and evidences ${title.toLowerCase()} control activities for this vendor service.`,
          `Provide policies, procedures, implementation details, monitoring approach, exceptions, and available evidence for ${controlRef}.`,
          `NIST SP 800-53 governance review question for ${title}.`,
          code,
          `TRV-NIST-800-53-${controlRef}`,
        );
      }
    }
  });

  const result = await prisma.$queryRawUnsafe(
    `
    select
      t.id,
      t.name,
      t."isActive",
      count(q.id) as "questionCount"
    from "AssessmentTemplate" t
    left join "AssessmentSection" s on s."templateId" = t.id
    left join "AssessmentQuestion" q on q."sectionId" = s.id
    where t.name = $1
    group by t.id, t.name, t."isActive"
    `,
    name,
  );

  console.dir(result, { depth: null });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

