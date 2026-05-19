const { PrismaClient } = require("@prisma/client");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const prisma = new PrismaClient();

function safeStr(value) {
  return typeof value === "string" ? value : "";
}

async function main() {
  const privateKey = fs.readFileSync(
    path.join(process.cwd(), "certs", "truvern-private.pem"),
    "utf8",
  );

  const rows = await prisma.$queryRawUnsafe(`
    select
      ra.id as "assignmentId",
      ra."vendorId" as "vendorId",
      v.name as "vendorName",
      rr.id as "responseId",
      rr.responses as responses
    from "ReviewAssignment" ra
    left join "Vendor" v on v.id = ra."vendorId"
    join "ReviewResponse" rr on rr."reviewAssignmentId" = ra.id
    where rr.responses ? 'governanceSeal'
    order by ra.id asc
  `);

  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    const responses = row.responses || {};
    const seal = responses.governanceSeal || {};
    const checksum = safeStr(seal.checksum);

    if (!checksum) {
      skipped++;
      continue;
    }

    if (seal.cryptographicSignature?.signature) {
      skipped++;
      continue;
    }

    const payload = {
      assignmentId: row.assignmentId,
      responseId: row.responseId,
      organizationId: responses?.governanceReleaseSnapshot?.organizationId || null,
      vendorId: row.vendorId,
      vendorName: row.vendorName,
      checksum,
      confirmedAt: responses.confirmedAt || null,
      releaseState: responses.releaseState || null,
      manifestVersion: "TRV-MANIFEST-1.0",
    };

    const canonicalPayload = JSON.stringify(payload);

    const signature = crypto
      .sign("sha256", Buffer.from(canonicalPayload, "utf8"), privateKey)
      .toString("base64");

    const cryptographicSignature = {
      algorithm: "RSA-SHA256",
      signature,
      signedAt: new Date().toISOString(),
      keyId: "truvern-governance-rsa-4096-v1",
      payloadHash: crypto
        .createHash("sha256")
        .update(canonicalPayload)
        .digest("hex"),
    };

    const nextResponses = {
      ...responses,
      governanceSeal: {
        ...seal,
        cryptographicSignature,
      },
      governanceReleaseSnapshot: {
        ...(responses.governanceReleaseSnapshot || {}),
        governanceSeal: {
          ...((responses.governanceReleaseSnapshot || {}).governanceSeal || seal),
          cryptographicSignature,
        },
      },
    };

    await prisma.$executeRawUnsafe(
      `
      update "ReviewResponse"
      set responses = $1::jsonb, "updatedAt" = now()
      where id = $2
      `,
      JSON.stringify(nextResponses),
      row.responseId,
    );

    updated++;
    console.log(`Signed assignment ${row.assignmentId}`);
  }

  console.log({ ok: true, updated, skipped, total: rows.length });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
