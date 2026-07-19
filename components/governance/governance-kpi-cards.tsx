type Kpi = {
  label: string;
  value: string | number;
  detail?: string;
  tone?: "cyan" | "emerald" | "amber" | "rose" | "violet" | "slate";
};

const toneClass: Record<NonNullable<Kpi["tone"]>, string> = {
  cyan: "border-cyan-300/20 bg-cyan-400/10 text-cyan-100",
  emerald: "border-emerald-300/20 bg-emerald-400/10 text-emerald-100",
  amber: "border-amber-300/20 bg-amber-400/10 text-amber-100",
  rose: "border-rose-300/20 bg-rose-400/10 text-rose-100",
  violet: "border-violet-300/20 bg-violet-400/10 text-violet-100",
  slate: "border-white/10 bg-white/[0.04] text-slate-200",
};

export default function GovernanceKpiCards({ items }: { items: Kpi[] }) {
  return (
    <section className="grid gap-4 md:grid-cols-5">
      {items.map((item) => (
        <div
          key={item.label}
          className={`rounded-3xl border p-5 ${toneClass[item.tone ?? "slate"]}`}
        >
          <p className="text-xs font-semibold uppercase tracking-[0.18em] opacity-80">
            {item.label}
          </p>
          <p className="mt-3 text-3xl font-semibold text-white">{item.value}</p>
          {item.detail ? (
            <p className="mt-2 text-sm opacity-80">{item.detail}</p>
          ) : null}
        </div>
      ))}
    </section>
  );
}
