"use client";

import { useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

type Props = {
  pack: "starter" | "growth" | "scale";
  label: string;
  featured?: boolean;
};

export default function CreditCheckoutButton({
  pack,
  label,
  featured = false,
}: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const currentQuery = searchParams?.toString();

  const returnTo = currentQuery
    ? `${pathname}?${currentQuery}`
    : pathname;

  async function startCheckout() {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/billing/credits/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          pack,
          returnTo,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data?.ok || !data?.url) {
        throw new Error(data?.error || "Unable to start checkout.");
      }

      window.location.href = data.url;
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to start checkout.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-6">
      <button
        type="button"
        onClick={startCheckout}
        disabled={loading}
        className={[
          "inline-flex w-full justify-center rounded-full px-5 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60",
          featured
            ? "bg-teal-300 text-slate-950 hover:bg-teal-200"
            : "border border-white/15 bg-white/5 text-white hover:bg-white/10",
        ].join(" ")}
      >
        {loading ? "Starting checkout..." : label}
      </button>

      {error ? (
        <p className="mt-3 rounded-2xl border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">
          {error}
        </p>
      ) : null}
    </div>
  );
}



