"use client";

import { useMemo, useState } from "react";

function clsx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

async function trackExport(payload: { kind: string; vendorId?: number | null; details?: any }) {
  try {
    await fetch("/api/usage/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    });
  } catch {
    // tracking must never block export
  }
}

function PrintIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={clsx("h-5 w-5", className)}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M7 8V4h10v4" />
      <path d="M6 17H5a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-1" />
      <path d="M7 14h10v6H7z" />
    </svg>
  );
}

export default function EvidenceRequestExportButton({
  requestId,
  vendorId,
  href,
  className = "btn-glass",
  hint = "Opens a print-ready audit packet (PDF-friendly) in a new tab.",
  variant = "icon", // 🔒 DEFAULT = ICON (prevents regressions)
  ariaLabel = "Print / Export",
  showHint = false,
}: {
  requestId: number;
  vendorId?: number | null;
  href: string;
  className?: string;
  hint?: string;
  variant?: "button" | "icon";
  ariaLabel?: string;
  showHint?: boolean;
}) {
  const [busy, setBusy] = useState(false);

  const tooltip = useMemo(() => {
    return hint ? `${ariaLabel} — ${hint}` : ariaLabel;
  }, [ariaLabel, hint]);

  const isIcon = variant === "icon";

  return (
    <div className={clsx("inline-flex", !isIcon && "flex-col items-start gap-1")}>
      <button
        type="button"
        className={clsx(
          className,
          busy && "opacity-80",
          isIcon && "px-2.5"
        )}
        aria-label={ariaLabel}
        title={isIcon ? tooltip : undefined}
        onClick={async () => {
          if (busy) return;
          setBusy(true);

          trackExport({
            kind: "EVIDENCE_REQUEST_EXPORT",
            vendorId: vendorId ?? null,
            details: { requestId, href },
          });

          const w = window.open(href, "_blank", "noopener,noreferrer");
          if (!w) window.location.href = href;

          setTimeout(() => setBusy(false), 650);
        }}
      >
        {isIcon ? (
          <span className="inline-flex items-center justify-center">
            <PrintIcon className={clsx("text-white/90", busy && "animate-pulse")} />
            <span className="sr-only">{ariaLabel}</span>
          </span>
        ) : (
          <>{busy ? "Opening…" : "Print / Export"}</>
        )}
      </button>

      {!isIcon && showHint ? (
        <div className="text-xs text-white/55">{hint}</div>
      ) : null}
    </div>
  );
}


