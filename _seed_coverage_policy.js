const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const DEFAULT_REQUIRED = [
  { key: "SOC2", label: "SOC 2 (Type II) Report", matchAny: ["SOC2", "SOC_2", "SOC2_REPORT", "SOC_2_REPORT"], priority: 1 },
  { key: "ISO27001", label: "ISO 27001 Certificate", matchAny: ["ISO27001", "ISO_27001", "ISO_27001_CERT", "ISO_CERT"], priority: 2 },
  { key: "PENTEST", label: "Penetration Test Report", matchAny: ["PENTEST", "PEN_TEST", "PENETRATION_TEST"], priority: 2 },
  { key: "VULN_SCAN", label: "Vulnerability Scan Results", matchAny: ["VULNERABILITY_SCAN", "VULN_SCAN", "SCAN_REPORT"], priority: 3 },
  { key: "SECURITY_POLICY", label: "Security Policy / Program Overview", matchAny: ["SECURITY_POLICY", "SECURITY_OVERVIEW", "SECURITY_PROGRAM"], priority: 3 },
  { key: "PRIVACY_POLICY", label: "Privacy Policy / Data Handling", matchAny: ["PRIVACY_POLICY", "DATA_PRIVACY", "DATA_HANDLING", "DPA"], priority: 3 },
  { key: "BCP_DR", label: "BCP/DR Plan", matchAny: ["BCP", "DR", "BCP_DR", "DISASTER_RECOVERY", "BUSINESS_CONTINUITY"], priority: 4 },
  { key: "INCIDENT", label: "Incident Response Plan", matchAny: ["INCIDENT_RESPONSE", "IR_PLAN", "INCIDENT_PLAN"], priority: 4 },
];

(async () => {
  // pick the first org (or adjust if you want a specific org)
  const org = await prisma.organization.findFirst({ orderBy: { id: "asc" } });
  if (!org) throw new Error("No Organization found.");

  const existing = await prisma.evidenceCoveragePolicy.findFirst({
    where: { organizationId: org.id },
    orderBy: { updatedAt: "desc" },
  });

  if (existing) {
    console.log("Policy already exists:", { id: existing.id, organizationId: org.id });
    process.exit(0);
  }

  const created = await prisma.evidenceCoveragePolicy.create({
    data: {
      organizationId: org.id,
      name: "Default Coverage Policy",
      enabled: true,
      requiredKinds: DEFAULT_REQUIRED,
    },
  });

  console.log("Created EvidenceCoveragePolicy:", created);
  process.exit(0);
})()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
