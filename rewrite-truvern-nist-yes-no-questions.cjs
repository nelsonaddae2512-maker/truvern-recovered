const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const families = [
  ["AC", "access control", [
    "Does your organization maintain documented access control policies for this vendor service?",
    "Are user access rights reviewed periodically for this vendor service?",
    "Is privileged access restricted and approved before use?",
    "Is access removed promptly when users leave or change roles?",
    "Is multi-factor authentication enforced for administrative access?",
    "Are access control exceptions tracked and remediated?"
  ]],
  ["AT", "awareness and training", [
    "Does your organization require security awareness training for personnel supporting this service?",
    "Is role-based security training provided where required?",
    "Are training completion records maintained?",
    "Are personnel trained on handling customer or regulated data?",
    "Are phishing or social engineering risks addressed in training?",
    "Are training gaps tracked to remediation?"
  ]],
  ["AU", "audit and accountability", [
    "Are security-relevant events logged for this vendor service?",
    "Are audit logs protected from unauthorized modification?",
    "Are logs reviewed or monitored on a defined cadence?",
    "Are failed access attempts captured and reviewed?",
    "Are audit records retained according to policy?",
    "Are audit findings tracked through remediation?"
  ]],
  ["CA", "assessment authorization and monitoring", [
    "Is this service subject to periodic security assessment?",
    "Are control deficiencies documented and tracked?",
    "Is remediation ownership assigned for identified gaps?",
    "Are assessment results reviewed by management?",
    "Is continuous monitoring performed for material risks?",
    "Are authorization or acceptance decisions documented?"
  ]],
  ["CM", "configuration management", [
    "Are secure configuration baselines maintained for this service?",
    "Are configuration changes reviewed before implementation?",
    "Are unauthorized configuration changes detected?",
    "Are production changes logged and approved?",
    "Are configuration exceptions documented?",
    "Are configuration weaknesses remediated in a defined timeframe?"
  ]],
  ["CP", "contingency planning", [
    "Does your organization maintain a contingency or recovery plan for this service?",
    "Is backup coverage defined for critical service data?",
    "Are recovery procedures tested periodically?",
    "Are recovery objectives documented?",
    "Are contingency roles and responsibilities assigned?",
    "Are recovery gaps tracked through remediation?"
  ]],
  ["IA", "identification and authentication", [
    "Are unique user identities required for access to this service?",
    "Is authentication enforced before system access?",
    "Are shared accounts prohibited or tightly controlled?",
    "Are password or credential requirements defined?",
    "Are inactive accounts disabled or removed?",
    "Are authentication failures monitored?"
  ]],
  ["IR", "incident response", [
    "Does your organization maintain an incident response process for this service?",
    "Are incidents triaged according to severity?",
    "Are customer-impacting incidents escalated promptly?",
    "Are breach notification obligations documented?",
    "Are incident response activities recorded?",
    "Are lessons learned tracked after incidents?"
  ]],
  ["MA", "maintenance", [
    "Is system maintenance authorized before performance?",
    "Are maintenance activities logged?",
    "Is remote maintenance access controlled?",
    "Are maintenance tools approved before use?",
    "Are maintenance personnel authorized?",
    "Are maintenance-related risks tracked?"
  ]],
  ["MP", "media protection", [
    "Is sensitive media protected from unauthorized access?",
    "Is media disposal handled securely?",
    "Is removable media restricted or controlled?",
    "Are media handling procedures documented?",
    "Is customer data protected during transfer or storage?",
    "Are media protection exceptions tracked?"
  ]],
  ["PE", "physical and environmental protection", [
    "Are facilities supporting this service physically protected?",
    "Is physical access restricted to authorized personnel?",
    "Are visitor access controls enforced?",
    "Are environmental safeguards in place for critical infrastructure?",
    "Are physical access logs maintained where applicable?",
    "Are physical security incidents tracked?"
  ]],
  ["PL", "planning", [
    "Are security requirements documented for this service?",
    "Is a security plan maintained or referenced for this service?",
    "Are system boundaries and responsibilities defined?",
    "Are privacy or compliance requirements identified?",
    "Are security plans reviewed periodically?",
    "Are planning gaps tracked to closure?"
  ]],
  ["PM", "program management", [
    "Is security governance assigned to accountable owners?",
    "Are vendor security risks reviewed by management?",
    "Are governance metrics tracked for this service?",
    "Are risk decisions documented?",
    "Are compliance obligations monitored?",
    "Are governance exceptions tracked?"
  ]],
  ["PS", "personnel security", [
    "Are personnel screened before supporting this service where required?",
    "Are confidentiality obligations acknowledged?",
    "Are terminations communicated for access removal?",
    "Are role changes reviewed for access impact?",
    "Are personnel security requirements documented?",
    "Are personnel-related exceptions tracked?"
  ]],
  ["PT", "PII processing and transparency", [
    "Is personal data processed only for authorized purposes?",
    "Are privacy obligations documented for this service?",
    "Are data subject or customer privacy requirements supported?",
    "Is personal data sharing controlled?",
    "Are privacy incidents escalated appropriately?",
    "Are privacy control gaps tracked?"
  ]],
  ["RA", "risk assessment", [
    "Is this service included in a risk assessment process?",
    "Are material risks documented?",
    "Are risks rated by likelihood or impact?",
    "Are risk owners assigned?",
    "Are risk treatment actions tracked?",
    "Are risk assessments updated periodically?"
  ]],
  ["SA", "system and services acquisition", [
    "Are security requirements included in vendor or service acquisition?",
    "Are supplier security obligations documented?",
    "Are third-party dependencies reviewed?",
    "Are service changes assessed for security impact?",
    "Are acquisition-related risks tracked?",
    "Are supplier commitments reviewed periodically?"
  ]],
  ["SC", "system and communications protection", [
    "Is data in transit protected using approved encryption?",
    "Is sensitive data at rest protected where required?",
    "Are network communications restricted to authorized paths?",
    "Are boundary protections implemented?",
    "Are system communications monitored for risk?",
    "Are communication protection gaps remediated?"
  ]],
  ["SI", "system and information integrity", [
    "Are vulnerabilities identified for this service?",
    "Are patches or mitigations applied within defined timelines?",
    "Is malicious code protection implemented where applicable?",
    "Are integrity alerts reviewed?",
    "Are system flaws tracked to remediation?",
    "Are integrity incidents documented?"
  ]],
  ["SR", "supply chain risk management", [
    "Are supply chain risks assessed for this service?",
    "Are subcontractors or critical dependencies identified?",
    "Are supplier security obligations monitored?",
    "Are supply chain incidents escalated?",
    "Are supplier risk exceptions documented?",
    "Are supply chain risks tracked through remediation?"
  ]]
];

async function main() {
  const template = await prisma.$queryRawUnsafe(`
    select id
    from "AssessmentTemplate"
    where name = 'Truvern NIST 800-53 Governance Review'
    limit 1
  `);

  if (!template.length) {
    throw new Error("Template not found.");
  }

  const templateId = template[0].id;

  for (let f = 0; f < families.length; f++) {
    const [code, familyName, questions] = families[f];

    for (let q = 0; q < questions.length; q++) {
      const orderIndex = f * 6 + q + 1;
      const controlRef = `${code}-${String(q + 1).padStart(2, "0")}`;

      await prisma.$executeRawUnsafe(`
        update "AssessmentQuestion"
        set
          text = $1,
          "helpText" = $2,
          description = $3,
          category = $4,
          type = 'YES_NO'::"QuestionType",
          options = '[
            {"label":"Yes","value":"YES","score":1},
            {"label":"No","value":"NO","score":0}
          ]'::jsonb,
          "updatedAt" = now()
        where "templateId" = $5
          and "orderIndex" = $6
      `,
        `${controlRef}: ${questions[q]}`,
        "Answer Yes only when the control is implemented and evidence can be provided. Answer No when it is not implemented, not known, or cannot be evidenced.",
        `Yes/No governance validation question for ${familyName}.`,
        code,
        templateId,
        orderIndex
      );
    }
  }

  const result = await prisma.$queryRawUnsafe(`
    select
      q.type::text as type,
      count(*)::int as count,
      min(q.text) as sample
    from "AssessmentQuestion" q
    where q."templateId" = $1
    group by q.type::text
  `, templateId);

  console.dir(result, { depth: null });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
