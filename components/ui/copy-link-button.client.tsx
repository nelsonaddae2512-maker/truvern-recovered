"use client";

import { useMemo, useState } from "react";

function clsx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function LinkIcon({ className }: { className?: string }) {
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
      <path d="M10 13a5 5 0 0 0 7.07 0l1.41-1.41a5 5 0 0 0 0-7.07 5 5 0 0 0-7.07 0L10 5" />
      <path d="M14 11a5 5 0 0 0-7.07 0L5.52 12.4a5 5 0 0 0 0 7.07 5 5 0 0 0 7.07 0L14 19" />
    </svg>
  );
}

async function copyText(text: string) {
  // Prefer modern clipboard API
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  // Fallback for older browsers / permissions
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "true");
  ta.style.position = "fixed";
  ta.style.left = "-9999px";
  ta.style.top = "-9999px";
  document.body.appendChild(ta);
  ta.select();
  document.execCommand("copy");
  document.body.removeChild(ta);
}

export default function CopyLinkButton({
  href,
  className = "btn-glass px-2.5",
  variant = "icon",
  ariaLabel = "Copy link",
  tooltip,
}: {
  /** Relative or absolute href. If relative, it will be resolved against current origin. */
  href: string;
  className?: string;
  variant?: "icon" | "button";
  ariaLabel?: string;
  tooltip?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  const resolved = useMemo(() => {
    const raw = (href || "").trim();
    if (!raw) return "";
    try {
      // If already absolute, keep it
      if (/^https?:\/\//i.test(raw)) return raw;
      return new URL(raw, window.location.origin).toString();
    } catch {
      return raw;
    }
  }, [href]);

  const title = useMemo(() => {
    const base = (tooltip || "").trim() || (resolved ? `Copy link €” ${resolved}` : "Copy link");
    if (copied) return "Copied!";
    if (busy) return "Copying€¦";
    return base;
  }, [tooltip, resolved, copied, busy]);

  const isIcon = variant === "icon";

  return (
    <button
      type="button"
      className={clsx(className, (busy || copied) && "opacity-90")}
      aria-label={ariaLabel}
      title={title}
      onClick={async () => {
        if (!resolved || busy) return;
        setBusy(true);
        try {
          await copyText(resolved);
          setCopied(true);
          setTimeout(() => setCopied(false), 900);
        } finally {
          setBusy(false);
        }
      }}
      disabled={!resolved || busy}
    >
      {isIcon ? (
        <span className="inline-flex items-center justify-center">
          <LinkIcon className={clsx("text-white/90", copied && "animate-pulse")} />
          <span className="sr-only">{ariaLabel}</span>
        </span>
      ) : (
        <span className="inline-flex items-center gap-2">
          <LinkIcon className={clsx("h-4 w-4 text-white/90", copied && "animate-pulse")} />
          <span>{copied ? "Copied" : "Copy link"}</span>
        </span>
      )}
    </button>
  );
}


