import Link from "next/link";

type Action = {
  label: string;
  href: string;
  tone?: "primary" | "secondary";
};

export default function QuickActionsCard({ actions }: { actions: Action[] }) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200">
        Quick Actions
      </p>

      <div className="mt-5 flex flex-wrap gap-3">
        {actions.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className={
              action.tone === "primary"
                ? "rounded-2xl border border-cyan-300/25 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-100 hover:bg-cyan-400/20"
                : "rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-semibold text-white hover:bg-white/[0.08]"
            }
          >
            {action.label}
          </Link>
        ))}
      </div>
    </section>
  );
}
