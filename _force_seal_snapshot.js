const crypto = require("crypto");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

function sha256Hex(input) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function stableStringify(x) {
  // Deterministic stringify for hashing (sort object keys)
  const seen = new WeakSet();
  return JSON.stringify(x, function (k, v) {
    if (v && typeof v === "object") {
      if (seen.has(v)) return "[Circular]";
      seen.add(v);
      if (Array.isArray(v)) return v;
      const out = {};
      for (const key of Object.keys(v).sort()) out[key] = v[key];
      return out;
    }
    return v;
  });
}

(async () => {
  // 🔧 Set these
  const orgId = 2;
  const vendorId = 1;

  // Find latest snapshot; if none, create a minimal one
  let snap = await prisma.vendorRiskSnapshot.findFirst({
    where: { organizationId: orgId, vendorId },
    orderBy: { createdAt: "desc" },
  });

  if (!snap) {
    snap = await prisma.vendorRiskSnapshot.create({
      data: {
        organizationId: orgId,
        vendorId,
        score: null,
        label: null,
        summary: "Dev force seal (bootstrap)",
        details: { boardPacket: { note: "bootstrap" } },
      },
    });
  }

  // If already sealed, exit idempotently
  if (snap.sealedAt && snap.sealedHash) {
    console.log("Already sealed:", {
      id: snap.id,
      sealedAt: snap.sealedAt,
      sealedHash: snap.sealedHash,
    });
    await prisma.$disconnect();
    return;
  }

  const now = new Date();

  // Hash includes snapshot id + org/vendor + details + createdAt (stable)
  const payload = {
    kind: "VendorRiskSnapshot",
    id: snap.id,
    organizationId: snap.organizationId,
    vendorId: snap.vendorId,
    createdAt: snap.createdAt,
    details: snap.details ?? null,
  };

  const hash = sha256Hex(stableStringify(payload));

  const updated = await prisma.vendorRiskSnapshot.update({
    where: { id: snap.id },
    data: {
      sealedAt: now,
      sealedHash: hash,
    },
    select: { id: true, vendorId: true, sealedAt: true, sealedHash: true },
  });

  console.log("Sealed snapshot:", updated);
  await prisma.$disconnect();
})();
