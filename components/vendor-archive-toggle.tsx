// components/vendor-archive-toggle.tsx
"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

function clsx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

type Props = {
  vendorId: number;
  isArchived: boolean;
  className?: string;
  compact?: boolean;
};

export default function VendorArchiveToggle({
  vendorId,
  isArchived,
  className,
  compact,
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const label = useMemo(() => {
    if (busy) return isArchived ? "Restoring€¦" : "Archiving€¦";
    return isArchived ? "Restore" : "Archive";
  }, [busy, isArchived]);

  async function run() {
    setErr(null);
    setMsg(null);
    setBusy(true);

    try {
      const res = await fetch(`/api/vendors/${vendorId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isArchived ? { restore: true } : { archive: true }),
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(txt || `Request failed (${res.status})`);
      }

      // œ… UX polish: set message + redirect to correct list view
      const nextHref = isArchived ? "/vendors?view=active" : "/vendors?view=archived";
      setMsg(isArchived ? "Vendor restored." : "Vendor archived.");

      // Ensure server components revalidate, then navigate
      router.refresh();
      router.push(nextHref);
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={clsx("flex flex-col items-end gap-1", className)}>
      <button
        type="button"
        onClick={run}
        disabled={busy}
        className={clsx(
          "inline-flex items-center gap-2 rounded-full border text-[11px] font-semibold",
          compact ? "px-3 py-1" : "px-3 py-1.5",
          isArchived
            ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/15"
            : "border-rose-500/25 bg-rose-500/10 text-rose-100 hover:bg-rose-500/15",
          busy ? "opacity-70 cursor-not-allowed" : ""
        )}
        title={isArchived ? "Restore this vendor" : "Archive this vendor (soft delete)"}
      >
        {label}
      </button>

      {msg ? <div className="text-[11px] text-emerald-200/90">{msg}</div> : null}
      {err ? <div className="text-[11px] text-rose-200/90">{err}</div> : null}
    </div>
  );
}


