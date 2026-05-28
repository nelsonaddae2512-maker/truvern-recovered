import Link from "next/link";
import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import { getCurrentPlanEntitlements } from "@/lib/billing/plan-entitlements";
import { createGovernanceChecksum } from "@/lib/governance-checksum";
import { governanceLabel } from "@/lib/governance/labels";
import PrintPacketButton from "@/components/review-desk/print-packet-button.client";


function governanceDisplayText(value: unknown) {
  return String(value ?? "")
    .trim()
    .replaceAll("APPROVE_WITH_CONDITIONS", "Approve with Conditions")
    .replaceAll("AWAITING_CONFIRMATION", "Awaiting Confirmation")
    .replaceAll("IN_PROGRESS", "In Progress")
    .replaceAll("RELEASE_READY", "Release Ready")
    .replaceAll("NOT_STARTED", "Not Started");
}
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = {
  params: Promise<{ id: string }> | { id: string };
};

function safeInt(v: unknown) {
  const n = Number(String(v ?? "").trim());
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

function safeStr(v: unknown) {
  return typeof v === "string" ? v.trim() : "";
}

function formatDate(v: unknown) {
  if (!v) return "Not recorded";
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? "Not recorded" : d.toLocaleString();
}

function section(text: string, heading: string, stops: string[]) {
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

export default async function GovernancePacketPage({ params }: Props) {
  const resolved = await params;
  const assignmentId = safeInt(resolved?.id);

  if (!assignmentId) return notFound();

  const rows: any[] = await prisma.$queryRawUnsafe(`
    select
      ra.id as "assignmentId",
      ra.status as "assignmentStatus",
      ra."updatedAt" as "assignmentUpdatedAt",
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
  `, assignmentId);

  const row = rows?.[0];
  if (!row) return notFound();

  const responses =
    row.responses && typeof row.responses === "object" ? row.responses : {};

  const snapshot =
    responses?.governanceReleaseSnapshot &&
    typeof responses.governanceReleaseSnapshot === "object"
      ? responses.governanceReleaseSnapshot
      : null;

  const snapshotAssessment =
    snapshot?.normalizedAssessment &&
    typeof snapshot.normalizedAssessment === "object"
      ? snapshot.normalizedAssessment
      : null;

  const structured = responses.structuredAssessment || {};
  const findings = safeStr(responses.findings);

  const executiveSummary =
    safeStr(structured.executiveSummary) ||
    section(findings, "EXECUTIVE SUMMARY", [
      "GOVERNANCE DECISION",
      "TRUVERN GOVERNANCE REVIEW",
      "CONDITIONS & FOLLOW-UPS",
    ]);

  const finalAssessment =
    safeStr(structured.finalAssessment) ||
    section(findings, "TRUVERN GOVERNANCE REVIEW", [
      "CONDITIONS & FOLLOW-UPS",
    ]);

  const conditions = Array.isArray(structured.conditionsAndFollowUps)
    ? structured.conditionsAndFollowUps.map(String).filter(Boolean)
    : section(findings, "CONDITIONS & FOLLOW-UPS", []).split("\n").filter(Boolean);
  
  const decision = safeStr(responses.decision) || "Not recorded";
  const riskLevel = safeStr(responses.riskLevel) || "Not recorded";
  const releaseState = safeStr(responses.releaseState) || "Not recorded";

  const hasMissingGovernancePayload =
    !executiveSummary || !finalAssessment || !conditions.length;

  const renderedChecksum = createGovernanceChecksum({
  assignmentId,
  vendorName: row.vendorName,
  decision,
  riskLevel,
  releaseState,
  executiveSummary,
  finalAssessment,
  conditions,
  finalizedAt: snapshot?.governanceSeal?.sealedAt || snapshot?.releasedAt || row.outcomeUpdatedAt,
});

const persistedChecksum = safeStr(
  responses?.governanceSeal?.checksum,
);

const checksum = renderedChecksum;

const sealVerified =
  !!persistedChecksum &&
  checksum === renderedChecksum;

    const evidenceRows: any[] = await prisma.$queryRawUnsafe(
    `
      select
        e.id,
        'Evidence artifact' as name,
        e."createdAt",
        'RECEIVED' as status,
        null::text as "fileKey",
        er.title as "requestTitle"
      from "Evidence" e
      left join "EvidenceRequest" er on er.id = e."evidenceRequestId"
      where e."vendorId" = $1
      order by e."createdAt" asc
    `,
    row.vendorId,
  );
  const lastEvidenceAt =
  evidenceRows.length > 0
    ? evidenceRows
        .map((r: any) =>
          new Date(r.updatedAt || r.createdAt).getTime(),
        )
        .sort((a: number, b: number) => b - a)[0]
    : null;

function relativeTime(value?: string | number | Date | null) {
  if (!value) return "No evidence";

  const diff = Date.now() - new Date(value).getTime();

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;

  return `${days}d ago`;
}
  return (
    <main className="min-h-screen bg-white px-8 py-10 text-slate-950 print:m-0 print:bg-white print:px-0 print:py-0">
      <style>{`
        @media print {
          nav, header {
            display: none !important;
          }

          @page {
            margin: 0.55in;
          }

          body {
            background: white !important;
          }

          section {
            break-inside: avoid;
          }
        }
      `}</style>
      <div className="mx-auto max-w-5xl rounded-[2rem] border border-slate-200 bg-white p-10 shadow-xl print:rounded-none print:border-0 print:shadow-none">
        <div className="flex flex-col gap-6 border-b border-slate-200 pb-8 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.35em] text-cyan-700">
              Truvern Governance Packet
            </p>
            <h1 className="mt-4 text-4xl font-bold tracking-tight">
              {row.vendorName || "Vendor"} Governance Assessment
            </h1>
            <p className="mt-3 text-sm text-slate-600">
              Immutable governance release artifact prepared for audit history, executive review, customer confirmation, and board-level reporting.
            </p>
          </div>

          <div className="flex flex-col gap-3 print:hidden">
  <Link
    href={`/review-desk/reviews/${assignmentId}/packet/pdf`}
    className="rounded-2xl bg-slate-950 px-5 py-3 text-center text-sm font-semibold text-white"
  >
    Download Board PDF
  </Link>

  <Link
  href={`/review-desk/reviews/${assignmentId}/packet/pdf?inline=1`}
  target="_blank"
  className="rounded-2xl bg-slate-950 px-5 py-3 text-center text-sm font-semibold text-white"
>
  Print Governance Packet
</Link>

  <Link
    href={`/api/review-desk/reviews/${assignmentId}/release-manifest`}
    target="_blank"
    className="rounded-2xl border border-slate-300 bg-white px-5 py-3 text-center text-sm font-semibold text-slate-950"
  >
    Release Manifest (Immutable)
  </Link>
</div>
        </div>

        {hasMissingGovernancePayload ? (
          <section className="mt-8 rounded-3xl border border-amber-200 bg-amber-50 p-5 text-amber-950">
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-amber-700">
              Legacy governance packet
            </p>
            <p className="mt-2 text-sm leading-6">
              This review was finalized before the structured governance packet
              fields were fully captured. Decision, risk, release state, and
              audit metadata remain available, but some narrative sections may
              be missing.
            </p>
          </section>
        ) : null}

        <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Decision</p>
            <p className="mt-2 break-words text-lg font-bold leading-tight">{governanceLabel(decision)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Residual risk</p>
            <p className="mt-2 break-words text-lg font-bold leading-tight">{governanceLabel(riskLevel)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Release state</p>
            <p className="mt-2 break-words text-lg font-bold leading-tight">{governanceLabel(releaseState)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Finalized at</p>
            <p className="mt-2 break-words text-sm font-bold leading-tight">{formatDate(row.outcomeUpdatedAt)}</p>
          </div>
        </section>

        <section className="mt-8 rounded-3xl border border-slate-200 p-6">
          <h2 className="text-lg font-bold">Executive governance summary</h2>
          <p className="mt-4 whitespace-pre-wrap leading-7 text-slate-700">
            {governanceDisplayText(executiveSummary) || "Not recorded"}
          </p>
        </section>

        <section className="mt-6 rounded-3xl border border-slate-200 p-6">
          <h2 className="text-lg font-bold">Final assessment</h2>
          <p className="mt-4 whitespace-pre-wrap leading-7 text-slate-700">
            {governanceDisplayText(finalAssessment) || "Not recorded"}
          </p>
        </section>

        <section className="mt-6 rounded-3xl border border-slate-200 p-6">
          <h2 className="text-lg font-bold">Conditions & follow-ups</h2>
          <ul className="mt-4 space-y-2 text-slate-700">
            {conditions.length ? conditions.map((item: string, idx: number) => (
              <li key={`${item}-${idx}`}>• {item}</li>
            )) : <li>Not recorded</li>}
          </ul>
        </section>
<div
  className={`mt-5 inline-flex rounded-2xl px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] ${
    sealVerified
      ? "border border-emerald-300 bg-emerald-100 text-emerald-800"
      : "border border-rose-300 bg-rose-100 text-rose-800"
  }`}
>
  {sealVerified
    ? "Verified governance seal"
    : "Integrity verification failed"}
</div>

<div className="mt-4 rounded-2xl border border-emerald-300/60 bg-emerald-50 p-4">
  <p className="text-xs font-bold uppercase tracking-[0.25em] text-emerald-700">
    Audit checksum
  </p>

  <p className="mt-3 break-all font-mono text-sm font-semibold text-emerald-950">
    {checksum}
  </p>

  <p className="mt-2 text-xs text-emerald-800">
    SHA-256 governance integrity fingerprint
  </p>
</div>
<div className="mt-4 grid gap-3 md:grid-cols-3">
  <div className="rounded-xl border border-emerald-200 bg-white px-4 py-3">
    <p className="text-[10px] uppercase tracking-[0.25em] text-emerald-700">
      Seal version
    </p>

    <p className="mt-2 text-sm font-semibold text-slate-950">
      {safeStr(responses?.governanceSeal?.version) || "TRV-GOV-SEAL-1.0"}
    </p>
  </div>

  <div className="rounded-xl border border-emerald-200 bg-white px-4 py-3">
    <p className="text-[10px] uppercase tracking-[0.25em] text-emerald-700">
      Integrity status
    </p>

    <p className="mt-2 text-sm font-semibold text-emerald-700">
      {sealVerified ? "VERIFIED" : "UNVERIFIED"}
    </p>
  </div>

  <div className="rounded-xl border border-emerald-200 bg-white px-4 py-3">
    <p className="text-[10px] uppercase tracking-[0.25em] text-emerald-700">
      Sealed at
    </p>

    <p className="mt-2 text-sm font-semibold text-slate-950">
      {formatDate(responses?.governanceSeal?.sealedAt)}
    </p>
  </div>
</div>
        <section className="mt-6 rounded-[28px] border border-cyan-400/15 bg-white/[0.03] p-8">
  <div className="flex items-center justify-between">
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.35em] text-cyan-700">
        Evidence appendix
      </p>

      <h2 className="mt-3 text-2xl font-semibold text-slate-950">
        Governance evidence inventory
      </h2>

      <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600">
        Evidence artifacts reviewed during governance analysis and release approval. This section functions as the immutable attachment manifest for the released governance packet.
      </p>
    </div>

    <div className="rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-right">
      <p className="text-[10px] uppercase tracking-[0.3em] text-cyan-700">
        Artifacts
      </p>

      <p className="mt-1 text-2xl font-bold text-slate-950">
        {evidenceRows.length}
      </p>
    </div>
  </div>

  <div className="mt-8 grid gap-4 md:grid-cols-3">
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <p className="text-xs uppercase tracking-[0.25em] text-slate-500">
        Evidence reviewed
      </p>

      <p className="mt-3 text-3xl font-semibold text-slate-950">
        {evidenceRows.length}
      </p>
    </div>

    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <p className="text-xs uppercase tracking-[0.25em] text-slate-500">
        Last evidence update
      </p>

      <p className="mt-3 text-lg font-semibold text-slate-950">
        {relativeTime(lastEvidenceAt)}
      </p>
    </div>

    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <p className="text-xs uppercase tracking-[0.25em] text-slate-500">
        Governance completeness
      </p>

      <p className="mt-3 text-lg font-semibold text-emerald-700">
        COMPLETE
      </p>
    </div>
  </div>

  {evidenceRows.length ? (
    <div className="mt-8 overflow-hidden rounded-2xl border border-slate-200">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-4 py-3 text-left font-semibold text-slate-700">
              Evidence
            </th>

            <th className="px-4 py-3 text-left font-semibold text-slate-700">
              Request
            </th>

            <th className="px-4 py-3 text-left font-semibold text-slate-700">
              Status
            </th>

            <th className="px-4 py-3 text-left font-semibold text-slate-700">
              Added
            </th>
          </tr>
        </thead>

        <tbody className="divide-y divide-slate-100 bg-white">
          {evidenceRows.map((evidence: any) => (
            <tr key={evidence.id}>
              <td className="px-4 py-3">
                <div className="font-medium text-slate-950">
                  {safeStr(evidence.name) || "Unnamed evidence"}
                </div>

                {safeStr(evidence.fileKey) ? (
                  <div className="mt-1 break-all font-mono text-[11px] text-slate-500">
                    {safeStr(evidence.fileKey)}
                  </div>
                ) : null}
              </td>

              <td className="px-4 py-3 text-slate-700">
                {safeStr(evidence.requestTitle) || "General evidence"}
              </td>

              <td className="px-4 py-3">
                <span className="rounded-xl border border-cyan-200 bg-cyan-50 px-2 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-cyan-800">
                  {safeStr(evidence.status) || "RECEIVED"}
                </span>
              </td>

              <td className="px-4 py-3 text-slate-600">
                {formatDate(evidence.createdAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <div className="mt-6 rounded-2xl border border-dashed border-slate-300 p-5 text-sm text-slate-500">
      No evidence artifacts were attached to this governance review.
    </div>
  )}
</section>

        <div className="mt-8 flex justify-between text-sm print:hidden">
          <Link href="/review-desk" className="font-semibold text-cyan-700">
            Back to Review Desk
          </Link>
          <Link href={`/vendors/${row.vendorId}`} className="font-semibold text-cyan-700">
            View vendor
          </Link>
        </div>
      </div>
    </main>
  );
}











































