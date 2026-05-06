const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

function pickOpenishStatus(vals) {
  const norm = (s) => String(s || "").toUpperCase();

  // Prefer anything that looks like "open/pending/requested/sent/outstanding"
  const preferred = vals.find((v) => {
    const s = norm(v);
    return (
      s.includes("OPEN") ||
      s.includes("PEND") ||
      s.includes("REQUEST") ||
      s.includes("SENT") ||
      s.includes("OUTSTAND") ||
      s.includes("WAIT")
    );
  });
  if (preferred) return preferred;

  // Avoid anything that looks "fulfilled/complete/cancel/closed"
  const nonTerminal = vals.find((v) => {
    const s = norm(v);
    return !(
      s.includes("FULFILL") ||
      s.includes("COMPLETE") ||
      s.includes("CANCEL") ||
      s.includes("CLOSE") ||
      s.includes("DONE") ||
      s.includes("REJECT") ||
      s.includes("DECLIN")
    );
  });
  return nonTerminal || vals[0];
}

(async () => {
  const orgId = 2;
  const vendorId = 1;

  // Pull enum values from the generated Prisma client (works if status is an enum)
  const client = require("@prisma/client");
  const enumVals = Array.isArray(client.EvidenceRequestStatus)
    ? client.EvidenceRequestStatus
    : client.EvidenceRequestStatus
    ? Object.values(client.EvidenceRequestStatus)
    : null;

  if (!enumVals || enumVals.length === 0) {
    console.log(
      "Could not read EvidenceRequestStatus enum from Prisma client. " +
        "If your schema uses a String status, tell me and I’ll adjust."
    );
    process.exit(1);
  }

  const status = pickOpenishStatus(enumVals);

  console.log("EvidenceRequestStatus enum values:", enumVals);
  console.log("Using status:", status);

  const now = Date.now();
  const mkDateDaysAgo = (days) => new Date(now - days * 86400000);

  const payloads = [
    {
      title: "SOC 2 Type II Report (latest)",
      notes: "Upload current SOC 2 report and bridge letter if applicable.",
      kind: "SOC2",
      createdAt: mkDateDaysAgo(7),
      dueAt: mkDateDaysAgo(-23), // due in 23 days
    },
    {
      title: "ISO 27001 Certificate + Statement of Applicability",
      notes: "Provide ISO cert and current SoA.",
      kind: "ISO27001",
      createdAt: mkDateDaysAgo(22),
      dueAt: mkDateDaysAgo(-8),
    },
    {
      title: "Vulnerability Management Policy",
      notes: "Provide latest VM policy and scan cadence.",
      kind: "POLICY",
      createdAt: mkDateDaysAgo(48),
      dueAt: mkDateDaysAgo(-2),
    },
  ];

  // Only include fields that exist in your schema
  // Your error output confirms: title, notes, dueAt, kind exist; createdAt exists.
  for (const p of payloads) {
    const created = await prisma.evidenceRequest.create({
      data: {
        organizationId: orgId,
        vendorId,
        status,
        title: p.title,
        notes: p.notes,
        kind: p.kind,
        dueAt: p.dueAt,
        createdAt: p.createdAt,
      },
      select: { id: true, status: true, title: true, createdAt: true, dueAt: true, kind: true },
    });
    console.log("Created:", created);
  }

  console.log("Done.");
})()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
