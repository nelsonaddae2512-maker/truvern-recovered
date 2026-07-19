// components/truvern-integrity-seal.tsx
function clsx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export default function TruvernIntegritySeal({
  compact,
  className,
}: {
  compact?: boolean;
  className?: string;
}) {
  return (
    <div
      className={clsx(
        "inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-200",
        className
      )}
    >
      <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400/90" />
      <span className={clsx(compact && "hidden sm:inline")}>Truvern Integrity Seal</span>
      <span className="opacity-80">·</span>
      <span>Verified</span>
    </div>
  );
}


