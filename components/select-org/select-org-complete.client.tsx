"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type BootstrapResponse =
  | {
      ok: true;
    }
  | {
      ok: false;
      reason?: string;
    };

function safeReturnTo(value: string | null) {
  const candidate = (value || "").trim();

  if (
    candidate.startsWith("/") &&
    !candidate.startsWith("//") &&
    !candidate.startsWith("/select-org")
  ) {
    return candidate;
  }

  return "/vendors";
}

export default function SelectOrgCompleteClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const started = useRef(false);

  const [error, setError] =
    useState<string | null>(null);

  const returnTo =
    safeReturnTo(
      searchParams.get("returnTo"),
    );

  useEffect(() => {
    if (started.current) {
      return;
    }

    started.current = true;

    let cancelled = false;

    async function completeBootstrap() {
      try {
        const response =
          await fetch(
            "/api/access/bootstrap-organization",
            {
              method: "POST",
              headers: {
                accept: "application/json",
              },
              cache: "no-store",
            },
          );

        const body =
          (await response
            .json()
            .catch(() => null)) as
            | BootstrapResponse
            | null;

        if (
          cancelled
        ) {
          return;
        }

        if (
          !response.ok ||
          !body ||
          body.ok !== true
        ) {
          const reason =
            body &&
            body.ok === false &&
            typeof body.reason === "string"
              ? body.reason
              : "BOOTSTRAP_FAILED";

          setError(reason);
          return;
        }

        router.replace(returnTo);
      } catch {
        if (!cancelled) {
          setError("BOOTSTRAP_FAILED");
        }
      }
    }

    void completeBootstrap();

    return () => {
      cancelled = true;
    };
  }, [returnTo, router]);

  if (error) {
    return (
      <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 p-5">
        <div className="text-sm font-semibold text-rose-100">
          Organization setup could not be completed.
        </div>

        <p className="mt-2 text-sm text-rose-100/80">
          Truvern did not open the workspace because organization
          verification did not complete successfully.
        </p>

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-xl border border-rose-300/30 bg-rose-400/10 px-3 py-2 text-sm font-semibold text-rose-50 hover:bg-rose-400/20"
          >
            Try again
          </button>

          <button
            type="button"
            onClick={() => router.replace("/select-org")}
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-slate-100 hover:bg-white/10"
          >
            Choose organization
          </button>
        </div>

        <div className="mt-3 text-xs text-rose-100/60">
          Reference: {error}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-cyan-400/20 bg-cyan-500/10 p-5">
      <div className="text-sm font-semibold text-cyan-50">
        Preparing your Truvern workspace…
      </div>

      <p className="mt-2 text-sm text-cyan-100/70">
        Verifying your organization and applying your authorized access.
      </p>
    </div>
  );
}