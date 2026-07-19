const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const families = [
  ["AC", "Access Control", [
    "Describe how access to systems and data is authorized, approved, and provisioned.",
    "Describe privileged access management controls for administrators and elevated users.",
    "How are user access reviews performed, documented, and remediated?",
    "Describe MFA enforcement for users, administrators, and remote access.",
    "How is least privilege enforced across applications, infrastructure, and data stores?",
    "Provide evidence of access control policies, access reviews, and privileged account monitoring."
  ]],
  ["AT", "Awareness and Training", [
    "Describe security awareness training provided to employees and contractors.",
    "How often is role-based security training completed?",
    "How is training completion tracked and enforced?",
    "Describe phishing, social engineering, or security simulation programs.",
    "How are privileged users trained on elevated access responsibilities?",
    "Provide evidence of recent training completion and training policy."
  ]],
  ["AU", "Audit and Accountability", [
    "Describe centralized logging and audit event collection.",
    "Which security events are logged across systems and applications?",
    "How are audit logs protected from unauthorized modification or deletion?",
    "Describe log retention requirements and retention periods.",
    "How are audit logs reviewed, alerted on, and investigated?",
    "Provide SIEM, logging, or audit monitoring evidence."
  ]],
  ["CA", "Assessment, Authorization, and Monitoring", [
    "Describe how security controls are assessed and validated.",
    "How often are control assessments performed?",
    "Describe remediation tracking for assessment findings.",
    "How is continuous monitoring performed?",
    "How are system authorization decisions documented?",
    "Provide evidence of recent assessments, monitoring reports, or remediation plans."
  ]],
  ["CM", "Configuration Management", [
    "Describe baseline configuration standards for systems and applications.",
    "How are configuration changes reviewed, approved, and tracked?",
    "Describe vulnerability-hardening standards for servers, endpoints, and cloud assets.",
    "How is unauthorized configuration drift detected?",
    "How are production changes tested before release?",
    "Provide evidence of change records, baseline standards, or configuration monitoring."
  ]],
  ["CP", "Contingency Planning", [
    "Describe business continuity and disaster recovery plans.",
    "How often are recovery plans tested?",
    "Describe backup scope, frequency, encryption, and retention.",
    "What are the RTO and RPO targets for critical systems?",
    "How are backup restoration tests documented?",
    "Provide evidence of recovery testing, backup reports, or continuity plans."
  ]],
  ["IA", "Identification and Authentication", [
    "Describe identity lifecycle management for users and service accounts.",
    "How are password, MFA, and authentication policies enforced?",
    "How are shared, dormant, or orphaned accounts detected?",
    "Describe authentication controls for APIs and machine identities.",
    "How are identity provider logs monitored?",
    "Provide evidence of identity policies and authentication configuration."
  ]],
  ["IR", "Incident Response", [
    "Describe incident response escalation and communication workflows.",
    "How are incidents classified by severity?",
    "How are incidents tracked from detection through closure?",
    "How are lessons learned documented after incidents?",
    "Describe incident response testing or tabletop exercises.",
    "Provide evidence of incident response plans, tickets, or test results."
  ]],
  ["MA", "Maintenance", [
    "Describe controls for system maintenance activities.",
    "How is remote maintenance access approved and monitored?",
    "How are maintenance tools controlled and logged?",
    "How are third-party maintenance activities authorized?",
    "Describe emergency maintenance procedures.",
    "Provide evidence of maintenance records or remote support controls."
  ]],
  ["MP", "Media Protection", [
    "Describe controls for removable media and portable storage.",
    "How is sensitive media encrypted, tracked, and disposed?",
    "Describe media sanitization and destruction procedures.",
    "How is data transfer to removable media restricted?",
    "How are backups and storage media protected?",
    "Provide evidence of media handling, encryption, or disposal records."
  ]],
  ["PE", "Physical and Environmental Protection", [
    "Describe physical access controls for offices, data centers, or hosting facilities.",
    "How is physical access reviewed and revoked?",
    "Describe visitor management and escort procedures.",
    "How are environmental risks monitored?",
    "How are physical access logs retained and reviewed?",
    "Provide evidence of badge access reports, facility controls, or hosting attestations."
  ]],
  ["PL", "Planning", [
    "Describe security planning and governance documentation.",
    "How are system security plans maintained?",
    "How are security requirements incorporated into business planning?",
    "Describe ownership for security control governance.",
    "How are policies reviewed and approved?",
    "Provide evidence of security plans, governance charters, or policy review records."
  ]],
  ["PM", "Program Management", [
    "Describe the organization-wide security program.",
    "How are security roles and responsibilities assigned?",
    "How is security program performance measured?",
    "Describe executive oversight of security risk.",
    "How are enterprise risks reported to leadership?",
    "Provide evidence of security governance meetings, dashboards, or program reports."
  ]],
  ["PS", "Personnel Security", [
    "Describe background screening and onboarding controls.",
    "How are employee terminations and transfers handled?",
    "How quickly is access removed after termination?",
    "Describe contractor access governance.",
    "How are personnel security incidents handled?",
    "Provide evidence of onboarding, termination, or access removal procedures."
  ]],
  ["PT", "PII Processing and Transparency", [
    "Describe PII inventory and processing governance.",
    "How is privacy notice and consent managed?",
    "How are privacy risks assessed?",
    "Describe data minimization and retention controls.",
    "How are data subject requests handled?",
    "Provide evidence of privacy policies, DPIAs, or PII processing records."
  ]],
  ["RA", "Risk Assessment", [
    "Describe enterprise risk assessment methodology.",
    "How are vendor and third-party risks assessed?",
    "How are vulnerabilities prioritized by risk?",
    "How are risk exceptions approved and tracked?",
    "How often are risk assessments updated?",
    "Provide evidence of risk registers, vendor risk reviews, or vulnerability prioritization."
  ]],
  ["SA", "System and Services Acquisition", [
    "Describe secure development lifecycle controls.",
    "How are security requirements included in procurement?",
    "How are third-party services evaluated before purchase?",
    "Describe supplier contract security requirements.",
    "How are software dependencies and components governed?",
    "Provide evidence of SDLC policies, procurement reviews, or supplier assessments."
  ]],
  ["SC", "System and Communications Protection", [
    "Describe network segmentation and boundary protection.",
    "How is encryption enforced for data in transit and at rest?",
    "Describe firewall, WAF, VPN, or zero-trust controls.",
    "How are secrets, certificates, and keys managed?",
    "How are external connections monitored?",
    "Provide evidence of network diagrams, encryption standards, or key management controls."
  ]],
  ["SI", "System and Information Integrity", [
    "Describe vulnerability scanning and remediation processes.",
    "How are patches prioritized and deployed?",
    "Describe malware protection and endpoint monitoring.",
    "How are system integrity alerts investigated?",
    "How are flaws tracked to closure?",
    "Provide evidence of vulnerability scans, patch reports, or endpoint protection."
  ]],
  ["SR", "Supply Chain Risk Management", [
    "Describe supply chain risk management governance.",
    "How are critical suppliers identified and monitored?",
    "How are supplier security requirements enforced?",
    "How are supplier incidents escalated?",
    "Describe supplier concentration or dependency risk monitoring.",
    "Provide evidence of supplier reviews, contracts, attestations, or risk ratings."
  ]]
];

async function main() {
  const template = await prisma.assessmentTemplate.findFirst({
    where: { name: "Truvern NIST 800-53 Governance Review" },
    select: { id: true, name: true },
  });

  if (!template) throw new Error("Template not found.");

  await prisma.assessmentQuestion.deleteMany({ where: { templateId: template.id } });
  await prisma.assessmentSection.deleteMany({ where: { templateId: template.id } });

  for (let i = 0; i < families.length; i++) {
    const [code, title, questions] = families[i];

    const section = await prisma.assessmentSection.create({
      data: {
        templateId: template.id,
        title: `${code} — ${title}`,
        description: `NIST 800-53 ${title} control family review.`,
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

  const count = await prisma.assessmentQuestion.count({
    where: { templateId: template.id },
  });

  console.log(`Template ${template.id} populated with ${count} questions.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
