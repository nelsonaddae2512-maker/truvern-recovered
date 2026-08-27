import { NextResponse } from "next/server";
import { governanceAuthErrorResponse } from "@/lib/auth/governance-auth-errors";
import { requireReleasePacketAccess } from "@/lib/auth/truvern-governance";
import { findTruvernFrameworkAssessment } from "@/lib/repositories/truvern-framework-assessment-repository";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteContext = {
  params: Promise<{ id: string }>;
};

function parseId(value: unknown) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function GET(_request: Request, context: RouteContext) {
  try {
  const { id: rawId } = await context.params;
  const assessmentId = parseId(rawId);

  if (!assessmentId) {
    return NextResponse.json({ ok: false, error: "Invalid assessment id." }, { status: 400 });
  }

  await requireReleasePacketAccess(assessmentId);

  const assessment = await findTruvernFrameworkAssessment({
    where: { id: assessmentId },
    include: {
      framework: true,
      findings: true,
      attestations: true,
    },
  });

  if (!assessment) {
    return NextResponse.json({ ok: false, error: "Assessment not found." }, { status: 404 });
  }
  const metadata = assessment.metadata && typeof assessment.metadata === "object" ? assessment.metadata as any : {};
  const seal = metadata.governanceSeal ?? null;
  const snapshot = metadata.governanceReleaseSnapshot ?? null;
  const evidence = Array.isArray(snapshot?.evidence) ? snapshot.evidence : [];

  /*
   * Immutable released-packet projection.
   *
   * A released governance packet must render historical
   * release facts from the persisted snapshot and seal,
   * never from mutable live workflow state.
   */
  const releasedAssessment =
    snapshot?.assessment &&
    typeof snapshot.assessment === "object"
      ? snapshot.assessment as any
      : {};

  const releasedFramework =
    snapshot?.framework &&
    typeof snapshot.framework === "object"
      ? snapshot.framework as any
      : {};

  const releasedFindings =
    Array.isArray(snapshot?.findings)
      ? snapshot.findings
      : [];
  const releasedAttestations =
    Array.isArray(snapshot?.attestations)
      ? snapshot.attestations
      : [];

  const packetTitle =
    String(
      releasedAssessment.title ??
      "Framework assessment release"
    );

  const packetStatus =
    String(
      releasedAssessment.status ??
      "RELEASED"
    );

  const packetRisk =
    releasedAssessment.riskLevel ??
    "Unscored";

  const packetScore =
    releasedAssessment.score ??
    "N/A";

  const packetMaxScore =
    releasedAssessment.maxScore ??
    "N/A";

  const packetFrameworkName =
    String(
      releasedFramework.name ??
      "Framework"
    );

  const packetFrameworkVersion =
    releasedFramework.version
      ? String(releasedFramework.version)
      : "";

  const packetReleasedAt =
    seal?.sealedAt ??
    releasedAssessment.releasedAt ??
    snapshot?.generatedAt ??
    null;

  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${packetTitle}</title>
  <style>
    body { font-family: Arial, sans-serif; background: #020617; color: #e5e7eb; margin: 0; padding: 40px; }
    .card { border: 1px solid rgba(255,255,255,.12); border-radius: 24px; padding: 24px; background: rgba(255,255,255,.04); margin-bottom: 20px; }
    .eyebrow { color: #67e8f9; text-transform: uppercase; letter-spacing: .2em; font-size: 12px; }
    h1 { color: white; font-size: 34px; margin: 12px 0; }
    h2 { color: white; font-size: 22px; }
    .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
    .metric { border: 1px solid rgba(255,255,255,.1); border-radius: 18px; padding: 14px; background: rgba(0,0,0,.22); }
    .muted { color: #94a3b8; }
    .seal { word-break: break-all; color: #a7f3d0; }
    .evidence { border: 1px solid rgba(255,255,255,.1); border-radius: 18px; padding: 14px; background: rgba(0,0,0,.22); margin-top: 10px; }
    .pill { display: inline-block; border: 1px solid rgba(103,232,249,.25); background: rgba(103,232,249,.08); color: #a5f3fc; border-radius: 999px; padding: 3px 8px; font-size: 11px; margin-right: 6px; }
    .timeline { border-left: 2px solid rgba(103,232,249,.25); margin-top: 14px; padding-left: 18px; }
    .event { margin: 0 0 16px 0; padding: 12px 14px; border: 1px solid rgba(255,255,255,.1); border-radius: 16px; background: rgba(0,0,0,.2); }
    .event-title { color: white; font-weight: bold; text-transform: capitalize; }
  </style>
</head>
<body>
  <section class="card">
    <div class="eyebrow">Truvern framework assessment release packet</div>
    <h1>${packetTitle}</h1>
    <p class="muted">${packetFrameworkName}${packetFrameworkVersion ? `  -  ${packetFrameworkVersion}` : ""}</p>
    <div class="grid">
      <div class="metric"><strong>Status</strong><br/>${packetStatus}</div>
      <div class="metric"><strong>Risk</strong><br/>${packetRisk}</div>
      <div class="metric"><strong>Score</strong><br/>${packetScore} / ${packetMaxScore}</div>
      <div class="metric"><strong>Released</strong><br/>${packetReleasedAt ?? "Not released"}</div>
    </div>
  </section>

  <section class="card">
    <h2>Governance seal</h2>
    <p><strong>Algorithm:</strong> ${seal?.algorithm ?? "Not sealed"}</p>
    <p><strong>Checksum:</strong></p>
    <p class="seal">${seal?.checksum ?? "Not available"}</p>
    <p><strong>Sealed at:</strong> ${seal?.sealedAt ?? "Not sealed"}</p>
    <h2>Cryptographic signature</h2>

    <p>
      <strong>Algorithm:</strong>
      ${seal?.cryptographicSignature?.algorithm ?? "Not signed"}
    </p>

    <p>
      <strong>Key ID:</strong>
      ${seal?.cryptographicSignature?.keyId ?? "Not available"}
    </p>

    <p>
      <strong>Signed at:</strong>
      ${seal?.cryptographicSignature?.signedAt ?? "Not available"}
    </p>

    <p><strong>Payload hash:</strong></p>
    <p class="seal">
      ${seal?.cryptographicSignature?.payloadHash ?? "Not available"}
    </p>

    <p><strong>Detached signature:</strong></p>
    <p class="seal">
      ${seal?.cryptographicSignature?.signature ?? "Not available"}
    </p>
  </section>

  <section class="card">
    <h2>Findings</h2>
    <p class="muted">${releasedFindings.length} finding(s) sealed into this release.</p>
    ${releasedFindings.map((finding: any) => `
      <div class="metric">
        <strong>${finding.severity}  -  ${finding.status}</strong><br/>
        ${finding.title}<br/>
        <span class="muted">${finding.description}</span>
      </div>
    `).join("")}
  </section>

  <section class="card">
    <h2>Attestations</h2>
    <p class="muted">${releasedAttestations.length} attestation(s) sealed into this release.</p>
    ${releasedAttestations.map((attestation: any) => `
      <div class="metric">
        <strong>${attestation.status}</strong><br/>
        ${attestation.title}<br/>
        <span class="muted">${attestation.description ?? ""}</span>
      </div>
    `).join("")}
  </section>

  <section class="card">
    <h2>Release provenance</h2>

    <div class="metric">
      <strong>Snapshot schema</strong><br/>
      ${snapshot?.schema ?? "Not available"}
    </div>

    <div class="metric">
      <strong>Snapshot generated</strong><br/>
      ${snapshot?.generatedAt ?? "Not available"}
    </div>

    <div class="metric">
      <strong>Sealed at</strong><br/>
      ${seal?.sealedAt ?? "Not available"}
    </div>

    <div class="metric">
      <strong>Seal version</strong><br/>
      ${seal?.version ?? "Not available"}
    </div>
  </section>

  <section class="card">
    <h2>Evidence inventory</h2>
    <p class="muted">${evidence.length} evidence object reference(s) sealed into this release snapshot.</p>
    ${evidence.length ? evidence.map((file: any) => `
      <div class="evidence">
        <span class="pill">${file.scope ?? "evidence"}</span>
        ${file.controlId ? `<span class="pill">${file.controlId}</span>` : ""}
        <strong>${file.filename ?? "Evidence file"}</strong><br/>
        <span class="muted">Evidence ID: ${file.evidenceId ?? "N/A"}</span><br/>
        <span class="muted">Content type: ${file.contentType ?? "N/A"}  -  Size: ${file.sizeBytes ?? "N/A"} bytes</span><br/>
        <span class="muted">S3 key:</span>
        <div class="seal">${file.key ?? "N/A"}</div>
      </div>
    `).join("") : `<p class="muted">No evidence files were sealed with this release.</p>`}
  </section>
</body>
</html>`;

  return new NextResponse(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
  } catch (error) {
    const authError = governanceAuthErrorResponse(error);
    if (authError) return authError;

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to generate framework assessment packet.",
      },
      { status: 500 },
    );
  }
}






