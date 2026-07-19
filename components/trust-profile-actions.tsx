// components/trust-profile-actions.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Props = {
  vendorId: number;
};

export default function TrustProfileActions({ vendorId }: Props) {
  const [shareUrl, setShareUrl] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setShareUrl(window.location.href);
    }
  }, []);

  async function handleCopy() {
    try {
      const text =
        shareUrl || (typeof window !== "undefined" ? window.location.href : "");
      if (!text) return;
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch (err) {
      console.error("Failed to copy trust profile URL", err);
    }
  }

  return (
    <div className="flex flex-wrap gap-2 text-xs">
      <button
        type="button"
        onClick={handleCopy}
        className="inline-flex items-center rounded-full border border-slate-700 bg-slate-950/70 px-3 py-2 font-medium text-slate-100 transition hover:border-emerald-400/70 hover:bg-slate-900"
      >
        {copied ? "Link copied" : "Copy trust link"}
      </button>

      <Link
        href={`/vendors/${vendorId}?view=workspace`}
        className="inline-flex items-center rounded-full border border-slate-700/70 bg-slate-900 px-3 py-2 font-medium text-slate-100 transition hover:border-emerald-400/70 hover:bg-slate-900/80"
      >
        Open vendor workspace
      </Link>
    </div>
  );
}

