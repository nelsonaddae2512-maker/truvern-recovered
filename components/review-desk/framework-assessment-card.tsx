import FrameworkAssessmentActions from "./framework-assessment-actions.client";
import FrameworkAssessmentEvidenceViewer from "./framework-assessment-evidence-viewer.client";
import FrameworkAssessmentAuditLog from "./framework-assessment-audit-log.client";

type FrameworkAssessmentCardProps = {
  assessment: {
    id: number;
    title: string;
    status: string;
    score: number | null;
    maxScore: number | null;
    riskLevel: string | null;
    vendorId: number | null;
    organizationId: number | null;
    readyForReleaseAt: string | Date | null;
    releasedAt: string | Date | null;
    updatedAt: string | Date;
    framework: {
      name: string;
      version: string | null;
      slug: string;
    };
    counts: {
      responses: number;
      findings: number;
      attestations: number;
    };
    findingSummary: {
      critical: number;
      high: number;
      open: number;
      remediationRequired: number;
      attestationRequired: number;
      attestationsOpen: number;
    };
  };
};

function riskTone(riskLevel: string | null) {
  if (riskLevel === "CRITICAL") return "border-red-400/30 bg-red-400/10 text-red-200";
  if (riskLevel === "HIGH") return "border-orange-400/30 bg-orange-400/10 text-orange-200";
  if (riskLevel === "MODERATE") return "border-amber-400/30 bg-amber-400/10 text-amber-200";
  if (riskLevel === "LOW") return "border-emerald-400/30 bg-emerald-400/10 text-emerald-200";
  return "border-slate-400/30 bg-slate-400/10 text-slate-200";
}

function statusTone(status: string) {
  if (status === "READY_FOR_RELEASE" || status === "RELEASED") {
    return "border-emerald-400/30 bg-emerald-400/10 text-emerald-200";
  }

  if (status === "REMEDIATION_REQUESTED" || status === "ATTESTATION_REQUESTED") {
    return "border-amber-400/30 bg-amber-400/10 text-amber-200";
  }

  if (status === "IN_REVIEW" || status === "SUBMITTED") {
    return "border-cyan-400/30 bg-cyan-400/10 text-cyan-200";
  }

  return "border-slate-400/30 bg-slate-400/10 text-slate-200";
}

export default function FrameworkAssessmentCard({ assessment }: FrameworkAssessmentCardProps) {
  const percent =
    assessment.score !== null && assessment.maxScore
      ? Math.round((assessment.score / assessment.maxScore) * 100)
      : null;

  return (
    <article className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-xl shadow-slate-950/20">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusTone(assessment.status)}`}>
              {assessment.status.replaceAll("_", " ")}
            </span>
            <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${riskTone(assessment.riskLevel)}`}>
              {assessment.riskLevel ?? "UNSCORED"}
            </span>
          </div>

          <h3 className="mt-3 text-lg font-semibold text-white">{assessment.title}</h3>
          <p className="mt-1 text-sm text-slate-400">
            {assessment.framework.name}
            {assessment.framework.version ? ` · ${assessment.framework.version}` : ""} · Assessment #{assessment.id}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          <Metric label="Score" value={percent === null ? "—" : `${percent}%`} />
          <Metric label="Findings" value={assessment.counts.findings} />
          <Metric label="Attest." value={assessment.counts.attestations} />
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <Signal label="Critical / High" value={`${assessment.findingSummary.critical} / ${assessment.findingSummary.high}`} />
        <Signal label="Remediation" value={assessment.findingSummary.remediationRequired} />
        <Signal label="Open attestations" value={assessment.findingSummary.attestationsOpen} />
      </div>

      <FrameworkAssessmentActions assessmentId={assessment.id} />

      <FrameworkAssessmentEvidenceViewer assessmentId={assessment.id} />

      <FrameworkAssessmentAuditLog assessmentId={assessment.id} />
    </article>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2">
      <div className="text-sm font-semibold text-white">{value}</div>
      <div className="mt-1 text-[10px] uppercase tracking-[0.16em] text-slate-500">{label}</div>
    </div>
  );
}

function Signal({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
      <div className="text-xs uppercase tracking-[0.16em] text-slate-500">{label}</div>
      <div className="mt-2 text-sm font-semibold text-slate-100">{value}</div>
    </div>
  );
}

function Endpoint({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1.5 text-xs font-semibold text-cyan-100 hover:bg-cyan-300/15"
    >
      {label}
    </a>
  );
}




