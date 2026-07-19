const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const CONTROL_TRANSLATIONS = {
  "AC-2": {
    title: "Document how user accounts are managed",
    reason: "We need evidence that user accounts are created, reviewed, modified, and removed through a controlled process.",
  },
  "IA-2": {
    title: "Show how accounts are protected with multi-factor authentication",
    reason: "We need evidence that important accounts are protected from unauthorized access.",
  },
  "CM-3": {
    title: "Document how system changes are managed",
    reason: "We need evidence that system changes are reviewed, approved, tested, and tracked.",
  },
  "SI-2": {
    title: "Show how vulnerabilities are identified and remediated",
    reason: "We need evidence that security issues are tracked and remediated within a defined process.",
  },
  "CA-2": {
    title: "Provide evidence of security assessment activities",
    reason: "We need evidence that your security controls are periodically reviewed or tested.",
  },
  "PL-2": {
    title: "Upload your information security policy",
    reason: "We need evidence that security expectations, responsibilities, and governance practices are documented.",
  },
  "PM-9": {
    title: "Describe how security governance responsibilities are assigned",
    reason: "We need evidence that security governance ownership and responsibilities are clearly assigned.",
  },
  "IR-4": {
    title: "Document your incident response process",
    reason: "We need evidence that security incidents are identified, escalated, handled, and reviewed through a documented process.",
  },
  "CP-2": {
    title: "Provide your business continuity and disaster recovery plans",
    reason: "We need evidence that your organization can continue or recover critical operations during disruption.",
  },
  "AU-6": {
    title: "Show how security logs are reviewed",
    reason: "We need evidence that security logs and monitoring alerts are reviewed and escalated when needed.",
  },
};

function safeStr(value) {
  return typeof value === "string" ? value.trim() : "";
}

function mappedControlsFromText(value) {
  return Array.from(new Set((safeStr(value).match(/\b[A-Z]{2}-\d+(?:\([a-z0-9]+\))?\b/g) || [])));
}

function vendorTitleForPackage(title, evidence) {
  const controls = mappedControlsFromText(`${title} ${(evidence || []).join(" ")}`);
  const translated = controls.map((control) => CONTROL_TRANSLATIONS[control]?.title).filter(Boolean);

  if (translated.some((item) => item.toLowerCase().includes("incident response"))) {
    return "Document your incident response process";
  }

  if (translated.some((item) => item.toLowerCase().includes("user accounts"))) {
    return "Document how user accounts are managed";
  }

  if (translated.some((item) => item.toLowerCase().includes("security policy"))) {
    return "Upload your information security policy and governance evidence";
  }

  if (translated.length > 0) return translated[0];

  return safeStr(title)
    .replace(/^vendor must resolve:\s*/i, "")
    .replace(/^[A-Z0-9- /]+:\s*/i, "")
    .replace(/\b[A-Z]{2}-\d+(?:\([a-z0-9]+\))?\b/g, "")
    .replace(/[:/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim() || "Provide remediation evidence requested by Truvern";
}

function vendorSummaryForPackage(title, evidence) {
  const controls = mappedControlsFromText(`${title} ${(evidence || []).join(" ")}`);
  const reasons = controls.map((control) => CONTROL_TRANSLATIONS[control]?.reason).filter(Boolean);

  if (reasons.length > 0) return Array.from(new Set(reasons)).join(" ");

  return "Truvern could not verify this control area from the submitted questionnaire and needs additional evidence before the review can be completed.";
}

async function main() {
  const rows = await prisma.$queryRawUnsafe(`
    select id, title, payload
    from "RemediationPackage"
    order by id asc
  `);

  let updated = 0;

  for (const row of rows) {
    const payload = row.payload || {};
    const requiredEvidence = Array.isArray(payload.requiredEvidence) ? payload.requiredEvidence : [];
    const title = safeStr(payload.internalTitle) || safeStr(payload.title) || safeStr(row.title);

    const nextPayload = {
      ...payload,
      title,
      internalTitle: title,
      vendorTitle: payload.vendorTitle || vendorTitleForPackage(title, requiredEvidence),
      vendorSummary: payload.vendorSummary || vendorSummaryForPackage(title, requiredEvidence),
      vendorInstructions:
        payload.vendorInstructions ||
        "Please upload the requested evidence and provide any required attestations so Truvern can validate this remediation item.",
      businessReason:
        payload.businessReason ||
        "This information is required before Truvern can complete the governance review.",
      technicalFinding: payload.technicalFinding || title,
      mappedControls:
        Array.isArray(payload.mappedControls) && payload.mappedControls.length > 0
          ? payload.mappedControls
          : mappedControlsFromText(`${title} ${requiredEvidence.join(" ")}`),
      reviewerNotes:
        payload.reviewerNotes ||
        "Vendor-facing language generated from Truvern Findings Engine remediation package.",
    };

    await prisma.$executeRawUnsafe(
      `
      update "RemediationPackage"
      set payload = $1::jsonb, "updatedAt" = now()
      where id = $2
      `,
      JSON.stringify(nextPayload),
      row.id,
    );

    updated++;
  }

  console.log(`Backfilled ${updated} remediation package payload(s).`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
