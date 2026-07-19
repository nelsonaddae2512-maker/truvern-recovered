"use client";

import Link from "next/link";

function clsx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

type Props = {
  vendorId: number;
  vendor?: any;

  // counts
  acceptedCriticalCount?: number;
  criticalOpenCount?: number;

  // may be undefined depending on caller/build paths
  openRequests?: any[];
};

export default function VendorActionability328A(props: Props) {
  const vendorId = Number(props?.vendorId);
  const acceptedCriticalCount = Number(props?.acceptedCriticalCount ?? 0) || 0;
  const criticalOpenCount = Number(props?.criticalOpenCount ?? 0) || 0;

  // œ… never allow undefined to reach `.filter`
  const openRequests: any[] = Array.isArray(props?.openRequests)
    ? props.openRequests
    : [];

  // Schema statuses: OPEN / SUBMITTED / APPROVED / REJECTED / CANCELLED
  const openCount = openRequests.filter(
    (r) => String(r?.status ?? "").toUpperCase() === "OPEN"
  ).length;

  // If you pass richer rows later, this will still work
  const submitted = openRequests.filter(
    (r) => String(r?.status ?? "").toUpperCase() === "SUBMITTED"
  );

  const latestSubmitted = submitted
    .slice()
    .sort((a, b) => {
      const sa = a?.submittedAt ? new Date(a.submittedAt).getTime() : 0;
      const sb = b?.submittedAt ? new Date(b.submittedAt).getTime() : 0;
      if (sb !== sa) return sb - sa;
      return Number(b?.id ?? 0) - Number(a?.id ?? 0);
    })[0];

  const latestSubmittedId = latestSubmitted?.id
    ? Number(latestSubmitted.id)
    : null;

  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-white">Next best action</div>
          <div className="mt-1 text-xs text-white/60">
            Review submissions, request missing evidence, and keep risk posture current.
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* œ… Review latest submission (only if we have one) */}
          {latestSubmittedId ? (
            <Link
              className="btn-primary inline-flex items-center gap-2"
              href={`/org/evidence-requests/${latestSubmittedId}`}
              title="Open the most recent SUBMITTED evidence request for review"
            >
              Review latest submission
              <span className="ml-1 rounded-full bg-white/15 px-2 py-0.5 text-xs font-semibold text-white/90">
                {submitted.length}
              </span>
              <span className="text-white/70">†—</span>
            </Link>
          ) : null}

          {/* œ… Open requests (OPEN / unsubmitted) */}
          {openCount > 0 ? (
            <Link
              className="btn-glass inline-flex items-center gap-2"
              href={`/vendors/${vendorId}#evidence`}
              title="Jump to Evidence Requests for this vendor"
            >
              Open requests
              <span className="ml-1 rounded-full bg-white/10 px-2 py-0.5 text-xs font-semibold text-white/80">
                {openCount}
              </span>
              <span className="text-white/70">†˜</span>
            </Link>
          ) : null}

          {/* œ… Evidence inbox / hub */}
          <Link className="btn-glass" href="/evidence" title="Evidence hub">
            Evidence Hub †—
          </Link>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <div className="text-xs font-semibold text-white/60">Critical open issues</div>
          <div className="mt-2 text-2xl font-semibold text-white tabular-nums">
            {criticalOpenCount}
          </div>
          <div className="mt-1 text-xs text-white/50">Top severity items still unresolved.</div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <div className="text-xs font-semibold text-white/60">Accepted critical risk</div>
          <div className="mt-2 text-2xl font-semibold text-white tabular-nums">
            {acceptedCriticalCount}
          </div>
          <div className="mt-1 text-xs text-white/50">Critical findings marked €œaccepted€.</div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <div className="text-xs font-semibold text-white/60">Outstanding evidence</div>
          <div className="mt-2 text-2xl font-semibold text-white tabular-nums">
            {openCount}
          </div>
          <div className="mt-1 text-xs text-white/50">Requests still waiting on submission.</div>
        </div>
      </div>

      {/* Small list (won€™t crash even if rows are partial) */}
      {openRequests.length > 0 ? (
        <div className="mt-4 rounded-2xl border border-white/10 bg-black/20">
          <div className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-white/50">
            Recent requests
          </div>
          <div className="divide-y divide-white/5">
            {openRequests.slice(0, 5).map((r) => (
              <div key={String(r?.id ?? Math.random())} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-white">
                    {r?.label ?? `Request #${r?.id ?? "€”"}`}
                  </div>
                  <div className="mt-1 text-xs text-white/60">
                    {String(r?.status ?? "€”")}
                  </div>
                </div>

                {r?.id ? (
                  <Link
                    className="btn-glass shrink-0"
                    href={`/org/evidence-requests/${r.id}`}
                    title="Open review"
                  >
                    Open †—
                  </Link>
                ) : (
                  <span className="text-xs text-white/40">€”</span>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}



