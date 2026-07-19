"use client";

import { useState } from "react";

type Props = {
  vendorId: number;
  vendorName?: string;
};

type Status = "idle" | "loading" | "ready" | "copied" | "error";

export default function VendorTrustLinkButton({ vendorId, vendorName }: Props) {
  const [link, setLink] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    setError(null);

    if (!vendorId || typeof vendorId !== "number") {
      setStatus("error");
      setError("Invalid vendor id");
      return;
    }

    try {
      setStatus("loading");

      const res = await fetch(`/api/trust-link?vendorId=${vendorId}`);
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const message =
          data?.error || `Failed to generate trust link (status ${res.status})`;
        throw new Error(message);
      }

      const data = await res.json();
      setLink(data.url as string);
      setStatus("ready");

      // ðŸ”¹ Optional: fire-and-forget activity feed entry (fails silently if route doesn't exist)
      try {
        await fetch("/api/activity", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "trust_link.generated",
            vendorId,
            message: `Trust link generated for vendor ${vendorName ?? vendorId}`,
          }),
        });
      } catch {
        // ignore activity errors €“ UX should not break
      }
    } catch (err: any) {
      setStatus("error");
      setError(err?.message || "Something went wrong while generating link");
    }
  };

  const copyLink = async () => {
    if (!link) return;

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(link);
      }
      setStatus("copied");
      // drop back to "ready" after a moment
      setTimeout(() => {
        setStatus("ready");
      }, 2000);
    } catch {
      setStatus("error");
      setError("Couldn't copy to clipboard. Please copy manually.");
    }
  };

  const buttonLabel =
    status === "loading"
      ? "Generating€¦"
      : link
      ? "Regenerate trust link"
      : "Generate trust link";

  return (
    <div className="flex flex-col items-end gap-1 text-xs">
      <button
        type="button"
        onClick={generate}
        disabled={status === "loading"}
        className="rounded-full bg-indigo-600 px-3 py-1.5 text-[11px] font-semibold text-slate-50 shadow-sm hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {buttonLabel}
      </button>

      {link && (
        <div className="mt-1 inline-flex max-w-xs items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1">
          <span className="max-w-[200px] truncate text-[11px] text-emerald-50">
            {link}
          </span>
          <button
            type="button"
            onClick={copyLink}
            className="text-[11px] font-semibold text-emerald-300 hover:text-emerald-200 underline underline-offset-2"
          >
            {status === "copied" ? "Copied" : "Copy"}
          </button>
        </div>
      )}

      {status === "loading" && (
        <span className="text-[11px] text-slate-400">
          Generating secure Truvern Trust Link€¦
        </span>
      )}

      {status === "copied" && (
        <span className="text-[11px] text-emerald-400">
          Link copied to clipboard.
        </span>
      )}

      {status === "error" && error && (
        <span className="text-[11px] text-red-400">{error}</span>
      )}
    </div>
  );
}


