type Props = {
  onTrack: number;
  warnings: number;
  critical: number;
};

export default function WorkflowHealthCard({ onTrack, warnings, critical }: Props) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200">
        Workflow Health
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-emerald-300/20 bg-emerald-400/10 p-4">
          <p className="text-sm text-emerald-100">On track</p>
          <p className="mt-2 text-3xl font-semibold text-white">{onTrack}</p>
        </div>

        <div className="rounded-2xl border border-amber-300/20 bg-amber-400/10 p-4">
          <p className="text-sm text-amber-100">SLA warnings</p>
          <p className="mt-2 text-3xl font-semibold text-white">{warnings}</p>
        </div>

        <div className="rounded-2xl border border-rose-300/20 bg-rose-400/10 p-4">
          <p className="text-sm text-rose-100">Critical</p>
          <p className="mt-2 text-3xl font-semibold text-white">{critical}</p>
        </div>
      </div>
    </section>
  );
}
