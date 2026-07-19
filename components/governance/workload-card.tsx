type Workload = {
  name: string;
  active: number;
  overdue?: number;
};

export default function WorkloadCard({ items }: { items: Workload[] }) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200">
        Team Workload
      </p>

      <div className="mt-5 grid gap-3">
        {items.length > 0 ? (
          items.map((item) => (
            <div
              key={item.name}
              className="rounded-2xl border border-white/10 bg-slate-950/70 p-4"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-white">{item.name}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    {item.overdue ?? 0} overdue
                  </p>
                </div>
                <p className="text-2xl font-semibold text-white">{item.active}</p>
              </div>
            </div>
          ))
        ) : (
          <p className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-slate-300">
            No active workload yet.
          </p>
        )}
      </div>
    </section>
  );
}
