"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  assessmentId: number;
  vendorId: number;
  cancelHref: string;
};

type AssignmentResponse = {
  ok?: boolean;
  assignmentId?: number;
  error?: string;
};

export default function StartInternalReview({
  assessmentId,
  vendorId,
  cancelHref,
}: Props) {
  const router = useRouter();

  const [busy, setBusy] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  async function startReview() {
    if (busy) {
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const response =
        await fetch(
          "/api/review-desk/assignments",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              vendorId,
              assessmentId,
              mode: "internal",
            }),
          },
        );

      const data =
        (await response
          .json()
          .catch(() => null)) as
          | AssignmentResponse
          | null;

      if (
        !response.ok ||
        !data?.ok ||
        !data.assignmentId
      ) {
        throw new Error(
          data?.error ||
            "Unable to start the internal review.",
        );
      }

      router.push(
        `/review-desk/reviews/${data.assignmentId}`,
      );

      router.refresh();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to start the internal review.",
      );

      setBusy(false);
    }
  }

  return (
    <div className="mt-6 space-y-4">
      {error ? (
        <div
          role="alert"
          className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100"
        >
          {error}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={startReview}
          disabled={busy}
          className="rounded-xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy
            ? "Starting review..."
            : "Start Self-Managed Review"}
        </button>

        <button
          type="button"
          onClick={() =>
            router.push(cancelHref)
          }
          disabled={busy}
          className="rounded-xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-slate-100 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Cancel
        </button>
      </div>

      <p className="text-xs text-slate-400">
        This starts an internal Self-Managed Review.
        No Truvern Review credit is required.
      </p>
    </div>
  );
}