"use client";

import { useState, useTransition } from "react";

type Props = {
  vendorId: number;
};

type LaunchResult = {
  ok?: boolean;
  error?: string;
  alreadyExists?: boolean;
  assignmentId?: number;
  assessmentId?: number;
  questionCount?: number;
  reviewDeskUrl?: string;
  vendorWorkspaceUrl?: string;
};

export default function ComprehensiveReviewLauncher({
  vendorId,
}: Props) {
  const [pending, startTransition] =
    useTransition();

  const [result, setResult] =
    useState<LaunchResult | null>(
      null,
    );

  const [error, setError] =
    useState("");

  function createReview() {
    setError("");

    startTransition(
      async () => {
        try {
          const response =
            await fetch(
              "/api/truvern/ops/comprehensive-reviews",
              {
                method:
                  "POST",
                headers: {
                  "content-type":
                    "application/json",
                },
                body:
                  JSON.stringify({
                    vendorId,
                  }),
              },
            );

          const json =
            (await response
              .json()
              .catch(
                () => ({}),
              )) as LaunchResult;

          if (
            !response.ok ||
            !json.ok
          ) {
            throw new Error(
              json.error ||
                "Failed to create comprehensive review.",
            );
          }

          setResult(json);
        } catch (caught) {
          setError(
            caught instanceof Error
              ? caught.message
              : "Failed to create comprehensive review.",
          );
        }
      },
    );
  }

  return (
    <div className="mt-6">
      {!result?.assessmentId ? (
        <button
          type="button"
          onClick={createReview}
          disabled={pending}
          className="rounded-2xl bg-cyan-300 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending
            ? "Creating comprehensive assessment..."
            : "Create comprehensive assessment"}
        </button>
      ) : null}

      {error ? (
        <div className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-500/10 p-4 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      {result?.assessmentId ? (
        <div className="mt-6 rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-5">
          <div className="text-sm font-semibold text-emerald-100">
            {result.alreadyExists
              ? "Active comprehensive review already exists."
              : "Comprehensive review created."}
          </div>

          <div className="mt-3 text-sm leading-6 text-slate-200">
            Assignment #{result.assignmentId}
            {" · "}
            Assessment #{result.assessmentId}
            {" · "}
            {result.questionCount ?? 0} canonical questions
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            {result.reviewDeskUrl ? (
              <a
                href={result.reviewDeskUrl}
                className="rounded-2xl bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
              >
                Open Review Desk
              </a>
            ) : null}

            {result.vendorWorkspaceUrl ? (
              <a
                href={result.vendorWorkspaceUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-2xl border border-white/15 bg-white/[0.05] px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.09]"
              >
                Preview vendor workspace
              </a>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}