// components/master-seal-badge.tsx

type MasterSealHealth = {
  status?: string; // "pass" | "fail" | "unknown"
  verified?: boolean;
  checkedAt?: string;
};

async function loadHealth(): Promise<MasterSealHealth | null> {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.APP_URL ||
    "";

  const url = base
    ? `${base.replace(/\/$/, "")}/ops/health/master-seal.json`
    : "/ops/health/master-seal.json";

  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as MasterSealHealth;
  } catch {
    return null;
  }
}

export async function MasterSealBadge() {
  const health = await loadHealth();

  const status = health?.status ?? (health?.verified ? "pass" : "unknown");

  const colorClass =
    status === "pass"
      ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/40"
      : status === "fail"
      ? "bg-rose-500/10 text-rose-300 border-rose-500/40"
      : "bg-slate-800/60 text-slate-300 border-slate-700";

  const label =
    status === "pass"
      ? "Master seal verified"
      : status === "fail"
      ? "Master seal failed"
      : "Master seal unknown";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${colorClass}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      Truvern Integrity · {label}
    </span>
  );
}

export default MasterSealBadge;


