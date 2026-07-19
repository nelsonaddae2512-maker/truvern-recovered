function isComplete(status: unknown) {
  return ["APPROVED", "COMPLETED", "FULFILLED", "RESOLVED", "CLOSED"].includes(
    String(status ?? "").toUpperCase(),
  );
}

function dueStatus(items: any[]) {
  const now = new Date();

  let overdue = 0;
  let dueSoon = 0;

  for (const item of items) {
    if (!item?.dueAt || isComplete(item?.status)) continue;

    const due = new Date(item.dueAt);
    if (Number.isNaN(due.getTime())) continue;

    const days = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (days < 0) overdue++;
    else if (days <= 3) dueSoon++;
  }

  if (overdue > 0) {
    return {
      label: `${overdue} overdue`,
      className: "border-rose-300/25 bg-rose-400/10 text-rose-100",
    };
  }

  if (dueSoon > 0) {
    return {
      label: `${dueSoon} due soon`,
      className: "border-amber-300/25 bg-amber-400/10 text-amber-100",
    };
  }

  return {
    label: "On track",
    className: "border-emerald-300/25 bg-emerald-400/10 text-emerald-100",
  };
}

type Props = {
  items: any[];
};

export default function VendorRemediationProgress({ items }: Props) {
  const total = items.length;
  const completed = items.filter((item) => isComplete(item?.status)).length;
  const remaining = Math.max(total - completed, 0);
  const percent = total > 0 ? Math.round((completed / total) * 100) : 100;
  const status = dueStatus(items);

  if (total === 0) {
    return (
      <section className="rounded-3xl border border-emerald-300/20 bg-emerald-400/10 p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-100">
          Remediation complete
        </p>
        <h2 className="mt-3 text-2xl font-semibold text-white">
          All requested remediation has been completed.
        </h2>
        <p className="mt-2 text-sm leading-6 text-emerald-50/80">
          Truvern is performing final governance validation. You will receive an update when the final report is ready.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-3xl border border-cyan-300/15 bg-slate-950/70 p-6 shadow-xl shadow-cyan-950/20">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-100">
            Vendor remediation progress
          </p>
          <h2 className="mt-3 text-2xl font-semibold text-white">
            {completed} of {total} package{total === 1 ? "" : "s"} completed
          </h2>
          <p className="mt-2 text-sm leading-6 text-cyan-50/80">
            Complete the remaining remediation packages so Truvern can finish governance validation and prepare the release packet.
          </p>
        </div>

        <span className={`rounded-full border px-4 py-2 text-sm font-semibold ${status.className}`}>
          {status.label}
        </span>
      </div>

      <div className="mt-5">
        <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
          <span>{percent}% complete</span>
          <span>{remaining} remaining</span>
        </div>

        <div className="mt-2 h-3 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-cyan-300"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      <div className="mt-5 grid gap-3 text-sm sm:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <p className="text-slate-500">Completed</p>
          <p className="mt-1 text-xl font-semibold text-white">{completed}</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <p className="text-slate-500">Remaining</p>
          <p className="mt-1 text-xl font-semibold text-white">{remaining}</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <p className="text-slate-500">Expected review</p>
          <p className="mt-1 text-xl font-semibold text-white">≈ 2 business days</p>
        </div>
      </div>
    </section>
  );
}
