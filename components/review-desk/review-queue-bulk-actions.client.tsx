"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export type SelectedReview = {
  id: number;
  vendorName: string;
  assignmentType: string;
  status: string;
  ageBucket: string;
  ownerState: string;
  recommendation: string;
};

type BulkContextValue = {
  selectedReviews: SelectedReview[];
  selectedIds: number[];
  isSelected: (id: number) => boolean;
  toggle: (review: SelectedReview) => void;
  replaceAll: (reviews: SelectedReview[]) => void;
  clear: () => void;
};

const BulkContext = createContext<BulkContextValue | null>(null);

function csvEscape(value: unknown) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function isReleaseReady(review: SelectedReview) {
  return (
    review.status.toUpperCase() === "COMPLETED" ||
    review.recommendation === "Ready for release review"
  );
}

function isAwaitingConfirmation(review: SelectedReview) {
  return review.status.toUpperCase() === "AWAITING_CONFIRMATION";
}

function downloadSelectedCsv(
  rows: SelectedReview[],
  filenamePrefix = "truvern-review-desk-export",
) {
  const header = [
    "Assignment ID",
    "Vendor",
    "Review Type",
    "Status",
    "Age Bucket",
    "Owner State",
    "Recommendation",
  ];

  const csv = [
    header.map(csvEscape).join(","),
    ...rows.map((row) =>
      [
        row.id,
        row.vendorName,
        row.assignmentType,
        row.status,
        row.ageBucket,
        row.ownerState,
        row.recommendation,
      ]
        .map(csvEscape)
        .join(","),
    ),
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `${filenamePrefix}-${new Date()
    .toISOString()
    .slice(0, 10)}.csv`;

  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);
}

export function ReviewQueueBulkProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [selected, setSelected] = useState<Map<number, SelectedReview>>(
    () => new Map(),
  );

  const value = useMemo<BulkContextValue>(() => {
    const selectedReviews = Array.from(selected.values());

    return {
      selectedReviews,
      selectedIds: selectedReviews.map((review) => review.id),
      isSelected: (id) => selected.has(id),
      toggle: (review) => {
        setSelected((current) => {
          const next = new Map(current);
          if (next.has(review.id)) next.delete(review.id);
          else next.set(review.id, review);
          return next;
        });
      },
      replaceAll: (reviews) => {
        setSelected(new Map(reviews.map((review) => [review.id, review])));
      },
      clear: () => {
        setSelected(new Map());
      },
    };
  }, [selected]);

  return <BulkContext.Provider value={value}>{children}</BulkContext.Provider>;
}

function useBulk() {
  const ctx = useContext(BulkContext);
  if (!ctx) throw new Error("Review queue bulk components must be inside provider");
  return ctx;
}

export function ReviewQueueBulkCheckbox({
  review,
}: {
  review: SelectedReview;
}) {
  const bulk = useBulk();
  const checked = bulk.isSelected(review.id);

  return (
    <button
      type="button"
      aria-label={checked ? "Remove review from selection" : "Add review to selection"}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        bulk.toggle(review);
      }}
      className={[
        "flex h-9 w-9 items-center justify-center rounded-xl border transition",
        checked
          ? "border-cyan-300/50 bg-cyan-500/20 text-cyan-50"
          : "border-white/10 bg-white/[0.04] text-slate-400 hover:bg-white/[0.08] hover:text-white",
      ].join(" ")}
    >
      {checked ? "x" : ""}
    </button>
  );
}

export function ReviewQueueBulkToolbar({
  visibleReviews,
}: {
  visibleReviews: SelectedReview[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const bulk = useBulk();

  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [lastRefreshAt, setLastRefreshAt] = useState(Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (busy) return;
      router.refresh();
      setLastRefreshAt(Date.now());
    }, 30000);

    return () => window.clearInterval(interval);
  }, [busy, router]);

  function refreshQueueWithParams(updates?: Record<string, string | number>) {
    const url = new URL(
      `${pathname}?${searchParams.toString()}`,
      window.location.origin,
    );

    Object.entries(updates || {}).forEach(([key, value]) => {
      url.searchParams.set(key, String(value));
    });

    url.searchParams.set("liveRefresh", String(Date.now()));

    router.replace(`${url.pathname}${url.search}`);
    router.refresh();
    setLastRefreshAt(Date.now());
  }

  const count = bulk.selectedReviews.length;

  const allVisibleSelected =
    visibleReviews.length > 0 &&
    visibleReviews.every((review) => bulk.selectedIds.includes(review.id));

  const releaseReadySelected = bulk.selectedReviews.filter(isReleaseReady);
  const releaseReadyCount = releaseReadySelected.length;

  const awaitingConfirmationSelected =
    bulk.selectedReviews.filter(isAwaitingConfirmation);
  const awaitingConfirmationCount = awaitingConfirmationSelected.length;

  async function bulkAssignToMe() {
    if (busy || !bulk.selectedIds.length) return;

    setBusy(true);
    setMessage("");

    try {
      const res = await fetch("/api/review-desk/reviews/bulk-assign", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ assignmentIds: bulk.selectedIds }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Failed to bulk assign reviews");
      }

      setMessage(
        `Assigned ${json.updated ?? 0}; skipped ${
          json.skippedAlreadyAssigned ?? 0
        } already assigned.`,
      );

      bulk.clear();

      refreshQueueWithParams({
        bulkAssigned: String(json.updated ?? 0),
        bulkSkipped: String(json.skippedAlreadyAssigned ?? 0),
      });
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Failed to bulk assign reviews",
      );
    } finally {
      setBusy(false);
    }
  }

  async function bulkConfirmReleased() {
    if (busy || !awaitingConfirmationSelected.length) return;

    setBusy(true);
    setMessage("");

    try {
      const results = await Promise.all(
        awaitingConfirmationSelected.map(async (review) => {
          const res = await fetch(
            `/api/review-desk/reviews/${review.id}/confirm-release`,
            { method: "POST" },
          );

          const json = await res.json().catch(() => null);
          return { ok: res.ok && json?.ok };
        }),
      );

      const confirmed = results.filter((r) => r.ok).length;

      setMessage(
        `Confirmed ${confirmed} released review${confirmed === 1 ? "" : "s"}.`,
      );

      bulk.clear();

      refreshQueueWithParams({
        bulkConfirmed: String(confirmed),
      });
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Failed to bulk confirm releases",
      );
    } finally {
      setBusy(false);
    }
  }

  async function bulkReleaseReady() {
    if (busy || !releaseReadySelected.length) return;

    setBusy(true);
    setMessage("");

    try {
      const res = await fetch("/api/review-desk/reviews/bulk-release", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          assignmentIds: releaseReadySelected.map((review) => review.id),
        }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Failed to bulk release reviews");
      }

      const released = json.released ?? 0;
      const skippedAlreadyReleased = json.skippedAlreadyReleased ?? 0;
      const skippedNotCompleted = json.skippedNotCompleted ?? 0;
      const skippedNoOutcome = json.skippedNoOutcome ?? 0;
      const skippedTotal =
        skippedAlreadyReleased + skippedNotCompleted + skippedNoOutcome;

      setMessage(
        [
          `Released ${released} governance outcome${released === 1 ? "" : "s"}.`,
          skippedAlreadyReleased
            ? `${skippedAlreadyReleased} already released`
            : null,
          skippedNotCompleted ? `${skippedNotCompleted} not completed` : null,
          skippedNoOutcome
            ? `${skippedNoOutcome} missing governance outcome`
            : null,
        ]
          .filter(Boolean)
          .join(" • "),
      );

      bulk.clear();

      refreshQueueWithParams({
        bulkReleased: String(released),
        bulkReleaseSkipped: String(skippedTotal),
      });
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Failed to bulk release reviews",
      );
    } finally {
      setBusy(false);
    }
  }

  if (!count) return null;

  return (
    <div className="sticky top-24 z-30 mt-4 rounded-3xl border border-cyan-400/20 bg-slate-950/90 p-4 shadow-2xl shadow-cyan-950/30 backdrop-blur-xl">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-cyan-200">
            Bulk governance operations
          </p>

          <p className="mt-1 text-sm text-slate-300">
            {count} review{count === 1 ? "" : "s"} selected
          </p>

          <div className="mt-2 flex flex-wrap gap-2">
            <div className="rounded-2xl border border-violet-400/20 bg-violet-500/10 px-3 py-1 text-[11px] text-violet-100">
              Release ready - {releaseReadyCount}
            </div>

            <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 px-3 py-1 text-[11px] text-amber-100">
              Awaiting confirmation - {awaitingConfirmationCount}
            </div>

            <div className="rounded-2xl border border-cyan-400/20 bg-cyan-500/10 px-3 py-1 text-[11px] text-cyan-100">
              Selected - {count}
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
            {message ? <p className="text-slate-400">{message}</p> : null}

            <span className="text-slate-500">Live queue refresh active</span>

            <span className="text-slate-600">
              Last sync {new Date(lastRefreshAt).toLocaleTimeString()}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              if (allVisibleSelected) bulk.clear();
              else bulk.replaceAll(visibleReviews);
            }}
            className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-2 text-xs font-semibold text-white hover:bg-white/[0.09]"
          >
            {allVisibleSelected ? "Clear visible" : "Select all visible"}
          </button>

          <button
            type="button"
            onClick={bulkAssignToMe}
            disabled={busy}
            className="rounded-2xl border border-emerald-400/30 bg-emerald-500/15 px-4 py-2 text-xs font-semibold text-emerald-50 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? "Working..." : "Bulk assign to me"}
          </button>

          <button
            type="button"
            onClick={bulkReleaseReady}
            disabled={busy || !releaseReadyCount}
            className="rounded-2xl border border-violet-400/30 bg-violet-500/15 px-4 py-2 text-xs font-semibold text-violet-50 hover:bg-violet-500/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "Working..." : "Bulk release ready"}
          </button>

          <button
            type="button"
            disabled={!releaseReadyCount}
            onClick={() =>
              downloadSelectedCsv(
                releaseReadySelected,
                "truvern-release-readiness-export",
              )
            }
            className="rounded-2xl border border-violet-400/30 bg-violet-500/15 px-4 py-2 text-xs font-semibold text-violet-50 hover:bg-violet-500/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Export release-ready
          </button>

          <button
            type="button"
            onClick={bulkConfirmReleased}
            disabled={busy || !awaitingConfirmationCount}
            className="rounded-2xl border border-amber-400/30 bg-amber-500/15 px-4 py-2 text-xs font-semibold text-amber-50 hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "Working..." : "Bulk confirm"}
          </button>

          <button
            type="button"
            onClick={() => downloadSelectedCsv(bulk.selectedReviews)}
            className="rounded-2xl border border-cyan-400/30 bg-cyan-500/15 px-4 py-2 text-xs font-semibold text-cyan-50 hover:bg-cyan-500/20"
          >
            Export selected CSV
          </button>

          <button
            type="button"
            onClick={bulk.clear}
            disabled={busy}
            className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-2 text-xs font-semibold text-white hover:bg-white/[0.09] disabled:cursor-not-allowed disabled:opacity-60"
          >
            Clear selection
          </button>
        </div>
      </div>
    </div>
  );
}


