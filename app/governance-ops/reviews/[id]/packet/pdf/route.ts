import QRCode from "qrcode";
import { NextResponse } from "next/server";
const PDFDocument = require("pdfkit/js/pdfkit.standalone.js");
import prisma from "@/lib/prisma";
import { getCurrentPlanEntitlements } from "@/lib/billing/plan-entitlements";
import { createGovernanceChecksum } from "@/lib/governance-checksum";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = {
  params: Promise<{ id: string }> | { id: string };
};

function safeStr(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function safeInt(value: unknown) {
  const n = Number(String(value ?? "").trim());
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

function governanceDisplayText(value: unknown) {
  return String(value ?? "")
    .trim()
    .replaceAll("APPROVE_WITH_CONDITIONS", "Approve with Conditions")
    .replaceAll("AWAITING_CONFIRMATION", "Awaiting Confirmation")
    .replaceAll("IN_PROGRESS", "In Progress")
    .replaceAll("RELEASE_READY", "Release Ready")
    .replaceAll("NOT_STARTED", "Not Started")
    .replaceAll("CONFIRMED", "Confirmed")
    .replaceAll("RELEASED", "Released")
    .replaceAll("HIGH", "High")
    .replaceAll("MEDIUM", "Medium")
    .replaceAll("LOW", "Low")
    .replaceAll("_", " ");
}
function sectionFromText(text: string, heading: string, stops: string[]) {
  const source = text || "";
  const start = source.toUpperCase().indexOf(heading.toUpperCase());
  if (start < 0) return "";

  const after = source.slice(start + heading.length).trim();
  let end = after.length;

  for (const stop of stops) {
    const idx = after.toUpperCase().indexOf(stop.toUpperCase());
    if (idx >= 0 && idx < end) end = idx;
  }

  return after.slice(0, end).trim();
}

function writeBlock(doc: any, title: string, body: string) {
  doc.moveDown(0.5);
  doc.fontSize(15).fillColor("#020617").text(title);
  doc.moveDown(0.4);
  doc.fontSize(10.5).fillColor("#334155").text(body || "Not recorded", {
    lineGap: 3,
    align: "left",
  });
}

export async function GET(request: Request, { params }: Props) {
  const resolved = await params;
  const assignmentId = safeInt(resolved?.id);

  if (!assignmentId) {
    return NextResponse.json({ ok: false, error: "Invalid assignment id." }, { status: 400 });
  }

  const rows = await prisma.$queryRawUnsafe(`
    select
      ra.id as "assignmentId",
      ra.status as "assignmentStatus",
      rr.responses,
      rr."updatedAt" as "outcomeUpdatedAt",
      v.id as "vendorId",
      v.name as "vendorName",
      v.category as "vendorCategory"
    from "ReviewAssignment" ra
    left join "ReviewResponse" rr on rr."reviewAssignmentId" = ra.id
    left join "ReviewRequest" req on req.id = ra."reviewRequestId"
    left join "Vendor" v on v.id = req."vendorId"
    where ra.id = $1
    order by rr."updatedAt" desc nulls last
    limit 1
  `, assignmentId) as any[];

  const row = rows?.[0];

  if (!row) {
    return NextResponse.json({ ok: false, error: "Review assignment not found." }, { status: 404 });
  }

  const responses =
    row.responses && typeof row.responses === "object" ? row.responses : {};

  const snapshot =
    responses?.governanceReleaseSnapshot &&
    typeof responses.governanceReleaseSnapshot === "object"
      ? responses.governanceReleaseSnapshot
      : null;

  const governanceReleasePackage =
    responses?.governanceReleasePackage &&
    typeof responses.governanceReleasePackage === "object"
      ? responses.governanceReleasePackage
      : snapshot?.governanceReleasePackage &&
          typeof snapshot.governanceReleasePackage === "object"
        ? snapshot.governanceReleasePackage
        : null;

  const canonicalGovernanceArtifact =
    governanceReleasePackage?.canonicalGovernanceArtifact &&
    typeof governanceReleasePackage.canonicalGovernanceArtifact === "object"
      ? governanceReleasePackage.canonicalGovernanceArtifact
      : responses?.canonicalGovernanceArtifact &&
          typeof responses.canonicalGovernanceArtifact === "object"
        ? responses.canonicalGovernanceArtifact
        : snapshot?.canonicalGovernanceArtifact &&
            typeof snapshot.canonicalGovernanceArtifact === "object"
          ? snapshot.canonicalGovernanceArtifact
          : null;

  const snapshotAssessment =
    snapshot?.normalizedAssessment &&
    typeof snapshot.normalizedAssessment === "object"
      ? snapshot.normalizedAssessment
      : null;

  const structured =
    responses.structuredAssessment && typeof responses.structuredAssessment === "object"
      ? responses.structuredAssessment
      : {};

  const findings = safeStr(snapshot?.findings) || safeStr(responses.findings);

  const executiveSummary =
    safeStr(governanceReleasePackage?.executiveSummary) ||
    safeStr(
      governanceReleasePackage?.canonicalGovernanceArtifact
        ?.executiveSummary,
    ) ||
    safeStr(canonicalGovernanceArtifact?.executiveSummary) ||
    safeStr((structured as any).executiveSummary) ||
    safeStr(snapshot?.executiveSummary) ||
    safeStr(snapshot?.governanceSummary) ||
    safeStr(responses?.executiveSummary) ||
    "Not recorded";

  const finalAssessment =
    safeStr(governanceReleasePackage?.finalAssessment) ||
    safeStr(governanceReleasePackage?.finalRecommendation) ||
    safeStr(
      governanceReleasePackage?.canonicalGovernanceArtifact
        ?.finalAssessment,
    ) ||
    safeStr(
      governanceReleasePackage?.canonicalGovernanceArtifact
        ?.finalRecommendation,
    ) ||
    safeStr(canonicalGovernanceArtifact?.finalAssessment) ||
    safeStr(canonicalGovernanceArtifact?.finalRecommendation) ||
    safeStr((structured as any).finalAssessment) ||
    safeStr((structured as any).finalRecommendation) ||
    safeStr(snapshot?.finalAssessment) ||
    safeStr(snapshot?.finalRecommendation) ||
    safeStr(responses?.finalAssessment) ||
    safeStr(responses?.finalRecommendation) ||
    "Not recorded";

  const conditions = Array.isArray(
    governanceReleasePackage?.conditionsAndFollowUps,
  )
    ? governanceReleasePackage.conditionsAndFollowUps
        .map(String)
        .filter(Boolean)
        .join("\n")
    : Array.isArray(
          governanceReleasePackage?.canonicalGovernanceArtifact
            ?.conditionsAndFollowUps,
        )
      ? governanceReleasePackage.canonicalGovernanceArtifact
          .conditionsAndFollowUps
          .map(String)
          .filter(Boolean)
          .join("\n")
      : Array.isArray(
            canonicalGovernanceArtifact?.conditionsAndFollowUps,
          )
        ? canonicalGovernanceArtifact.conditionsAndFollowUps
            .map(String)
            .filter(Boolean)
            .join("\n")
        : Array.isArray((structured as any).conditionsAndFollowUps)
          ? (structured as any).conditionsAndFollowUps
              .map(String)
              .filter(Boolean)
              .join("\n")
          : "";

  const renderedChecksum = createGovernanceChecksum({
    assignmentId,
    vendorName: row.vendorName,
    decision: responses.decision,
    riskLevel: responses.riskLevel,
    releaseState: responses.releaseState,
    executiveSummary,
    finalAssessment,
    conditions: String(conditions || "")
      .split("\n")
      .map((v) => v.trim())
      .filter(Boolean),
    finalizedAt: snapshot?.governanceSeal?.sealedAt || snapshot?.releasedAt || row.outcomeUpdatedAt,
  });

  const checksum =
    safeStr(responses?.governanceSeal?.checksum) || renderedChecksum;

  
  const cryptographicSignature =
    responses?.governanceSeal?.cryptographicSignature?.signature || "";

  const signatureFingerprint = cryptographicSignature
    ? cryptographicSignature.slice(0, 32)
    : "Not signed";
const doc = new PDFDocument({
  size: "LETTER",
  margin: 54,
  bufferPages: true,
});
  const chunks: Buffer[] = [];

  doc.on("data", (chunk: Buffer) => chunks.push(chunk));

  const done = new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });
  const pageLeft = doc.page.margins.left;
  const pageRight = doc.page.width - doc.page.margins.right;
  const pageWidth = pageRight - pageLeft;

  doc.fontSize(10).fillColor("#0891b2").text("TRUVERN IMMUTABLE GOVERNANCE RECORD", {
    characterSpacing: 3,
  });

  doc.moveDown(0.9);

  doc
    .fontSize(25)
    .fillColor("#020617")
    .text(`${safeStr(row.vendorName) || "Vendor"} Governance Assessment`, {
      lineGap: 2,
    });

  doc.moveDown(0.45);

  doc
    .fontSize(10.5)
    .fillColor("#475569")
    .text("Immutable governance release artifact prepared for audit history, executive review, customer confirmation, and board-level reporting.", {
      width: pageWidth - 40,
      lineGap: 3,
    });

  doc.moveDown(0.5);

  doc
    .strokeColor("#e2e8f0")
    .lineWidth(1)
    .moveTo(pageLeft, doc.y)
    .lineTo(pageRight, doc.y)
    .stroke();

  doc.moveDown(0.35);

  const finalizedText = row.outcomeUpdatedAt
    ? new Date(row.outcomeUpdatedAt).toLocaleString()
    : "Not recorded";

  const cardTop = doc.y;
  const cardGap = 10;
  const cardWidth = (pageWidth - cardGap * 3) / 4;
  const cardHeight = 74;

  const cards = [
    ["Decision", governanceDisplayText(responses.decision) || "Not recorded"],
    ["Residual risk", governanceDisplayText(responses.riskLevel) || "Not recorded"],
    ["Release state", governanceDisplayText(responses.releaseState) || "Not recorded"],
    ["Finalized at", finalizedText],
  ];

  cards.forEach(([label, value], index) => {
    const x = pageLeft + index * (cardWidth + cardGap);

    doc
      .roundedRect(x, cardTop, cardWidth, cardHeight, 12)
      .strokeColor("#cbd5e1")
      .lineWidth(0.8)
      .stroke();

    doc
      .fontSize(7.5)
      .fillColor("#64748b")
      .text(label.toUpperCase(), x + 12, cardTop + 14, {
        width: cardWidth - 24,
        characterSpacing: 1.4,
      });

    doc
      .fontSize(value.length > 22 ? 10.2 : 12)
      .fillColor("#020617")
      .text(value, x + 12, cardTop + 36, {
        width: cardWidth - 24,
        lineGap: 2,
      });
  });

  doc.y = cardTop + cardHeight + 24;
  doc.x = pageLeft;
writeBlock(doc, "Executive Summary", governanceDisplayText(executiveSummary));
  writeBlock(doc, "Final Assessment", governanceDisplayText(finalAssessment));
  writeBlock(doc, "Conditions & Follow-ups", governanceDisplayText(conditions));

const evidenceRows: any[] = await prisma.$queryRawUnsafe(
  `
    select
      e.id,
      e."createdAt",
      er.title as "requestTitle"
    from "Evidence" e
    left join "EvidenceRequest" er on er.id = e."evidenceRequestId"
    where e."vendorId" = $1
    order by e."createdAt" asc
  `,
  row.vendorId,
);

doc.moveDown(0.35);

doc
  .fontSize(15)
  .fillColor("#020617")
  .text("Evidence Appendix / Immutable Attachment Manifest");

doc.moveDown(0.5);

doc
  .fontSize(10)
  .fillColor("#475569")
  .text(
    `Governance evidence inventory containing ${evidenceRows.length} reviewed artifact(s), preserved as the immutable attachment manifest for this release packet.`,
    {
      lineGap: 3,
    },
  );

doc.moveDown(0.5);

if (evidenceRows.length) {
  evidenceRows.forEach((evidence: any, index: number) => {
    doc
      .fontSize(10)
      .fillColor("#111827")
      .text(
        `${index + 1}. ${
          safeStr(evidence.requestTitle) || "General evidence"
        }`,
        {
          continued: false,
        },
      );

    doc
      .fontSize(8.5)
      .fillColor("#64748b")
      .text(
        `Added: ${
          evidence.createdAt
            ? new Date(evidence.createdAt).toLocaleString()
            : "Not recorded"
        }`,
      );

    doc.moveDown(0.4);
  });
} else {
  doc
    .fontSize(9)
    .fillColor("#64748b")
    .text("No evidence artifacts attached to this governance review.");
}
  doc.moveDown(0.8);

  const manifestGeneratedAt = new Date().toISOString();

  const manifestRows = [
    ["Release ID", `TRV-REL-${assignmentId}`],
    ["Assignment ID", String(assignmentId)],
    ["Vendor ID", String(row.vendorId || "Unknown")],
    ["Packet version", "TRV-PACKET-1.0"],
    ["Snapshot version", safeStr(responses?.governanceSeal?.version) || "TRV-GOV-SEAL-1.0"],
    ["Seal algorithm", "SHA-256"],
    [
      "Signature algorithm",
      responses?.governanceSeal?.cryptographicSignature?.algorithm ||
        "RSA-SHA256",
    ],
    ["Evidence artifacts", String(evidenceRows.length)],
    ["Attachment manifest", "TRV-EVIDENCE-MANIFEST-1.0"],
    ["Release classification", governanceDisplayText(responses.releaseState) || "Confirmed"],
    ["Generated timestamp", manifestGeneratedAt],
    ["Manifest checksum", checksum.slice(0, 24)],
    ["Signature fingerprint", signatureFingerprint],
  ];

  const requiredManifestHeight =
    manifestRows.length * 24 + 90;

  if (doc.y + requiredManifestHeight > doc.page.height - 90) {
    doc.addPage();
    doc.x = pageLeft;
    doc.y = 64;
  }

  doc
    .fontSize(15)
    .fillColor("#020617")
    .text("Immutable Release Manifest");

  doc.moveDown(0.5);

  const manifestTop = doc.y;
  const manifestRowHeight = 24;

  const manifestHeight =
    manifestRows.length * manifestRowHeight + 36;

  doc
    .roundedRect(pageLeft, manifestTop, pageWidth, manifestHeight, 12)
    .strokeColor("#cbd5e1")
    .lineWidth(0.8)
    .stroke();

  manifestRows.forEach(([label, value], index) => {
    const y = manifestTop + 10 + index * manifestRowHeight;

    if (index > 0) {
      doc
        .moveTo(pageLeft + 12, y - 4)
        .lineTo(pageLeft + pageWidth - 12, y - 4)
        .strokeColor("#e2e8f0")
        .lineWidth(0.6)
        .stroke();
    }

    doc
      .fontSize(8)
      .fillColor("#64748b")
      .text(label.toUpperCase(), pageLeft + 16, y, {
        width: 180,
        characterSpacing: 1,
      });

    doc
      .fontSize(9)
      .fillColor("#020617")
      .text(value, pageLeft + 210, y, {
        width: pageWidth - 230,
        lineGap: 1,
      });
  });

  doc.y = manifestTop + manifestHeight + 18;
  doc.x = pageLeft;

  doc.moveDown(0.8);


  const assessmentGeneratedAt =
    snapshot?.assessmentGeneratedAt ||
    snapshot?.generatedAt ||
    snapshot?.createdAt ||
    responses?.assessmentGeneratedAt ||
    responses?.draftSavedAt ||
    row.createdAt ||
    row.updatedAt ||
    responses?.releasedAt ||
    responses?.confirmedAt ||
    responses?.governanceSeal?.sealedAt;

  const reviewFinalizedAt =
    snapshot?.reviewFinalizedAt ||
    snapshot?.finalizedAt ||
    snapshot?.releasedAt ||
    responses?.reviewFinalizedAt ||
    responses?.releasedAt ||
    responses?.submittedAt ||
    row.updatedAt;
  const timelineRows = [
    [
      "Assessment generated",
      assessmentGeneratedAt
        ? new Date(assessmentGeneratedAt).toLocaleString()
        : (
            row.createdAt
              ? new Date(row.createdAt).toLocaleString()
              : (
                  row.updatedAt
                    ? new Date(row.updatedAt).toLocaleString()
                    : "Not recorded"
                )
          ),
    ],
    [
      "Review finalized",
      reviewFinalizedAt
        ? new Date(reviewFinalizedAt).toLocaleString()
        : (
            row.updatedAt
              ? new Date(row.updatedAt).toLocaleString()
              : "Not recorded"
          ),
    ],
    [
      "Customer confirmed",
      responses?.confirmedAt
        ? new Date(responses.confirmedAt).toLocaleString()
        : "Pending confirmation",
    ],
    [
      "Governance sealed",
      responses?.governanceSeal?.sealedAt
        ? new Date(responses.governanceSeal.sealedAt).toLocaleString()
        : "Not sealed",
    ],
    ["Immutable release generated", new Date().toLocaleString()],
  ];

  doc
    .fontSize(15)
    .fillColor("#020617")
    .text("Immutable Release Timeline");

  doc.moveDown(0.45);

  const timelineTop = doc.y;
  const timelineRowHeight = 30;

  doc
    .roundedRect(
      pageLeft,
      timelineTop,
      pageWidth,
      timelineRows.length * timelineRowHeight + 10,
      12,
    )
    .strokeColor("#cbd5e1")
    .lineWidth(0.8)
    .stroke();

  timelineRows.forEach(([label, value], index) => {
    const y = timelineTop + 10 + index * timelineRowHeight;

    if (index > 0) {
      doc
        .moveTo(pageLeft + 12, y - 5)
        .lineTo(pageLeft + pageWidth - 12, y - 5)
        .strokeColor("#e2e8f0")
        .lineWidth(0.6)
        .stroke();
    }

    doc
      .circle(pageLeft + 22, y + 8, 4)
      .fillAndStroke("#0891b2", "#0891b2");

    doc
      .fontSize(8)
      .fillColor("#64748b")
      .text(label.toUpperCase(), pageLeft + 38, y, {
        width: 220,
        characterSpacing: 1,
      });

    doc
      .fontSize(9)
      .fillColor("#020617")
      .text(value, pageLeft + 270, y, {
        width: pageWidth - 290,
        lineGap: 1,
      });
  });

  doc.y = timelineTop + timelineRows.length * timelineRowHeight + 18;
  doc.x = pageLeft;

  doc.moveDown(0.35);

  doc
    .fontSize(10)
    .fillColor("#065f46")
    .text("Audit checksum", {
      underline: true,
    });

  doc.moveDown(0.4);

  doc
    .fontSize(9)
    .fillColor("#111827")
    .text(checksum);

  doc.moveDown(0.2);

  doc
    .fontSize(8)
    .fillColor("#64748b")
    .text("SHA-256 governance integrity fingerprint");

  doc.moveDown(0.35);

doc
  .fontSize(8)
  .fillColor("#065f46")
  .text(
    `Seal version: ${
      safeStr(responses?.governanceSeal?.version) || "TRV-GOV-SEAL-1.0"
    }`,
  );

doc
  .fontSize(8)
  .fillColor("#065f46")
  .text(
    `Integrity status: ${
      checksum === renderedChecksum ? "VERIFIED" : "UNVERIFIED"
    }`,
  );

doc
  .fontSize(8)
  .fillColor("#065f46")
  .text(
    `Sealed at: ${
      responses?.governanceSeal?.sealedAt
        ? new Date(responses.governanceSeal.sealedAt).toLocaleString()
        : "Not recorded"
    }`,
  );

doc.moveDown(0.5);

doc.fontSize(9).fillColor("#64748b").text(
  "Truvern Governance Systems • Immutable Governance Record",
  { align: "center" },
);



const requiredSignatureHeight = 170;

if (doc.y + requiredSignatureHeight > doc.page.height - 90) {
  doc.addPage();
  doc.x = pageLeft;
  doc.y = 64;
}

doc.fontSize(10).fillColor("#0891b2").text("GOVERNANCE SIGNATURES & ATTESTATION", {
  characterSpacing: 2.5,
});

doc.moveDown(0.35);

const signatureTop = doc.y;
const signatureGap = 14;
const signatureWidth = (pageWidth - signatureGap * 2) / 3;
const signatureHeight = 86;

const signatureBlocks = [
  {
    label: "Truvern governance reviewer",
    name:
      safeStr(snapshot?.reviewerName) ||
      safeStr(responses?.governanceSeal?.reviewerName) ||
      "Truvern Governance Network",
    meta: "Review release authority",
  },
  {
    label: "Customer confirmation",
    name: responses?.confirmedAt
      ? "Confirmed by customer"
      : "Customer confirmation recorded",
    meta: responses?.confirmedAt
      ? new Date(responses.confirmedAt).toLocaleString()
      : "Timestamp preserved in release record",
  },
  {
    label: "Immutable seal attestation",
    name: checksum === renderedChecksum ? "Seal verified" : "Seal pending review",
    meta: `SIG ${signatureFingerprint.slice(0, 16)}... • CHK ${checksum.slice(0, 12)}...`,
  },
];

signatureBlocks.forEach((block, index) => {
  const x = pageLeft + index * (signatureWidth + signatureGap);

  doc
    .roundedRect(x, signatureTop, signatureWidth, signatureHeight, 12)
    .strokeColor("#cbd5e1")
    .lineWidth(0.8)
    .stroke();

  doc
    .fontSize(7.5)
    .fillColor("#64748b")
    .text(block.label.toUpperCase(), x + 12, signatureTop + 14, {
      width: signatureWidth - 24,
      characterSpacing: 1.1,
    });

  doc
    .fontSize(10.5)
    .fillColor("#020617")
    .text(block.name, x + 12, signatureTop + 36, {
      width: signatureWidth - 24,
      lineGap: 2,
    });

  doc
    .moveTo(x + 12, signatureTop + 66)
    .lineTo(x + signatureWidth - 12, signatureTop + 66)
    .strokeColor("#e2e8f0")
    .lineWidth(0.8)
    .stroke();

  doc
    .fontSize(7.5)
    .fillColor("#64748b")
    .text(block.meta, x + 12, signatureTop + 72, {
      width: signatureWidth - 24,
      lineGap: 1,
    });
});

doc.y = signatureTop + signatureHeight + 8;
doc.x = pageLeft;

doc.fontSize(9).fillColor("#64748b").text(
  "Truvern Governance Systems • Immutable Governance Record",
  { align: "center" },
);

const verifyUrl = `${process.env.NEXT_PUBLIC_APP_URL || "https://www.truvern.com"}/api/governance/verify/${assignmentId}`;

const qrDataUrl = await QRCode.toDataURL(verifyUrl, {
  margin: 1,
  width: 180,
});


doc.moveDown(0.5);

const verifyTop = doc.y;

doc
  .roundedRect(pageLeft, verifyTop, pageWidth, 62, 12)
  .strokeColor("#cbd5e1")
  .lineWidth(0.8)
  .stroke();

doc
  .fontSize(8)
  .fillColor("#0891b2")
  .text("PUBLIC VERIFICATION RECORD", pageLeft + 14, verifyTop + 12, {
    characterSpacing: 1.4,
  });

doc
  .fontSize(9)
  .fillColor("#020617")
  .text(`Verify this governance release: ${verifyUrl}`, pageLeft + 14, verifyTop + 30, {
    width: pageWidth - 28,
    lineGap: 2,
  });

doc
  .fontSize(7.5)
  .fillColor("#64748b")
  .text(`Release record: assignment-${assignmentId} • Checksum ${checksum.slice(0, 16)}...`, pageLeft + 14, verifyTop + 46, {
    width: pageWidth - 120,
  });

doc.image(
  qrDataUrl,
  pageLeft + pageWidth - 82,
  verifyTop + 8,
  {
    fit: [58, 58],
    align: "center",
    valign: "center",
  },
);

doc
  .fontSize(6.5)
  .fillColor("#64748b")
  .text(
    "Scan to verify",
    pageLeft + pageWidth - 84,
    verifyTop + 68,
    {
      width: 60,
      align: "center",
    },
  );

doc.y = verifyTop + 84;
doc.x = pageLeft;
  const range = doc.bufferedPageRange();

  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(i);

    const footerY = doc.page.height - 42;

    doc
      .fontSize(8)
      .fillColor("#94a3b8")
      .text(
        `Truvern Governance Systems • Immutable Governance Record • Page ${i + 1} of ${range.count}`,
        54,
        footerY,
        {
          width: doc.page.width - 108,
          align: "center",
        },
      );
  }
  doc.end();

  const pdf = await done;

  const body = new Uint8Array(pdf).buffer;

  return new NextResponse(body, {
    status: 200,
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `${new URL(request.url).searchParams.get("inline") === "1" ? "inline" : "attachment"}; filename="truvern-governance-packet-${assignmentId}.pdf"`,
      "cache-control": "no-store",
    },
  });
}



















































