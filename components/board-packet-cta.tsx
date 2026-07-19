// components/board-packet-cta.tsx
import Link from "next/link";

type Props = {
  variant?: "primary" | "ghost";
  className?: string;
  label?: string;
};

export default function BoardPacketCTA({
  variant = "primary",
  className = "",
  label = "Open Board Packet",
}: Props) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition";
  const styles =
    variant === "primary"
      ? "bg-emerald-400/15 text-emerald-100 ring-1 ring-emerald-400/25 hover:bg-emerald-400/20"
      : "text-slate-200/80 ring-1 ring-white/10 hover:ring-white/20 hover:text-slate-50";

  return (
    <Link href="/reports/board" className={`${base} ${styles} ${className}`}>
      {label}
      <span aria-hidden className="text-xs opacity-80">
        †—
      </span>
    </Link>
  );
}


