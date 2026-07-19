// components/vendors/vendor-risk-snapshot.tsx
import Link from "next/link";

function clsx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function fmtDate(d?: Date | string | null) {
  if (!d) return "-";
  const dt = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(dt.getTime())) return "-";
  return dt.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function badgeTone(score: number | null) {
  if (score == null) return "border-slate-700/70 bg-slate-900/40 text-slate-200";
  if (score >= 80) return "border-rose-500/40 bg-rose-500/10 text-rose-200";
  if (score >= 60) return "border-amber-500/40 bg-amber-500/10 text-amber-200";
  if (score >= 35) return "border-sky-500/40 bg-sky-500/10 text-sky-200";
  return "border-emerald-500/40 bg-emerald-500/10 text-emerald-200";
}

export type VendorRiskSnapshotProps = {
  vendorId: number;
  score: number | null;
  openCount: number | null;
  acceptedCount: number | null;
  resolvedCount: number | null;
  lastAssessedAt: Date | string | null;
  evidenceProvided: number | null;
  evidenceRequested: number | null;
  evidencePct: number | null;
};

export default function VendorRiskSnapshot(props: VendorRiskSnapshotProps) {
  const {
    vendorId,
    score,
    openCount,
    acceptedCount,
    resolvedCount,
    lastAssessedAt,
    evidenceProvided,
    evidenceRequested,
    evidencePct,
  } = props;

  const scoreLabel = score == null ? "-" : `${score}`;
  const pctLabel = evidencePct == null ? "-" : `${evidencePct}%`;

  return (
    <section className="mt-5 rounded-2xl border border-slate-800/70 bg-slate-950/35 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-sm text-slate-300/90">Risk Snapshot</div>
          <div className="mt-1 text-xs text-slate-400">
            Updated from live issues, assessments, and evidence signals.
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link href={`/issues?vendorId=${vendorId}`} className="text-sky-300 hover:underline">
            View findings
          </Link>
          <Link href="/vendors" className="text-sky-300 hover:underline">
            Back to vendors
          </Link>
        </div>
      </div>
    </section>
  );
}

