"use client";

import { useMemo, useState } from "react";

type VerifyResult = {
  ok?: boolean;
  verified?: boolean;
  checksum?: string | null;
  releaseState?: string | null;
  signatureValid?: boolean;
  checkpointValid?: boolean;
  transparencyIncluded?: boolean;
  latestEntryHash?: string | null;
  merkleRoot?: string | null;
  error?: string | null;
};

function safeJsonParse(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export default function PublicGovernanceVerifyPage() {
  const [bundleInput, setBundleInput] = useState("");
  const [manifestInput, setManifestInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VerifyResult | null>(null);

  const parsedBundle = useMemo(
    () => safeJsonParse(bundleInput),
    [bundleInput],
  );

  const parsedManifest = useMemo(
    () => safeJsonParse(manifestInput),
    [manifestInput],
  );

  async function runVerification() {
    setLoading(true);
    setResult(null);

    try {
      const verifyResponse = await fetch(
        "/api/governance/public-verify",
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            bundle: parsedBundle,
            manifest: parsedManifest,
          }),
        },
      );

      const data = await verifyResponse.json();

      setResult(data);
    } catch (error: any) {
      setResult({
        ok: false,
        error:
          typeof error?.message === "string"
            ? error.message
            : "Verification failed.",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#020617] text-white">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="max-w-3xl">
          <div className="inline-flex items-center rounded-full border border-emerald-400/30 bg-emerald-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-emerald-200">
            Truvern Governance Verification
          </div>

          <h1 className="mt-6 text-5xl font-semibold tracking-tight">
            Public governance verifier
          </h1>

          <p className="mt-6 text-lg leading-8 text-slate-300">
            Validate governance manifests, signed verification bundles,
            transparency ledger inclusion, and checkpoint integrity
            independently outside Truvern internal systems.
          </p>
        </div>

        <div className="mt-12 grid gap-8 lg:grid-cols-2">
          <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">
                Verification bundle
              </h2>

              <div className="rounded-full border border-fuchsia-400/30 bg-fuchsia-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-fuchsia-200">
                Signed
              </div>
            </div>

            <textarea
              value={bundleInput}
              onChange={(e) => setBundleInput(e.target.value)}
              spellCheck={false}
              placeholder="Paste verification bundle JSON..."
              className="mt-5 h-[420px] w-full rounded-2xl border border-white/10 bg-black/30 p-4 font-mono text-xs text-slate-100 outline-none transition focus:border-fuchsia-400/40"
            />
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">
                Release manifest
              </h2>

              <div className="rounded-full border border-violet-400/30 bg-violet-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-violet-200">
                Immutable
              </div>
            </div>

            <textarea
              value={manifestInput}
              onChange={(e) => setManifestInput(e.target.value)}
              spellCheck={false}
              placeholder="Paste release manifest JSON..."
              className="mt-5 h-[420px] w-full rounded-2xl border border-white/10 bg-black/30 p-4 font-mono text-xs text-slate-100 outline-none transition focus:border-violet-400/40"
            />
          </section>
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={runVerification}
            disabled={loading}
            className="rounded-2xl border border-emerald-400/30 bg-emerald-500/15 px-6 py-4 text-sm font-semibold text-emerald-50 transition hover:bg-emerald-500/25 disabled:opacity-50"
          >
            {loading
              ? "Verifying integrity..."
              : "Verify governance artifacts"}
          </button>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-xs uppercase tracking-[0.3em] text-slate-400">
            External verification supported
          </div>
        </div>

        {result ? (
          <section className="mt-10 rounded-3xl border border-white/10 bg-white/[0.03] p-8">
            <div className="flex flex-wrap items-center gap-4">
              <div
                className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] ${
                  result.verified
                    ? "border border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
                    : "border border-rose-400/30 bg-rose-500/10 text-rose-200"
                }`}
              >
                {result.verified
                  ? "Verification passed"
                  : "Verification failed"}
              </div>

              {result.signatureValid ? (
                <div className="rounded-full border border-cyan-400/30 bg-cyan-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-cyan-200">
                  Signature valid
                </div>
              ) : null}

              {result.transparencyIncluded ? (
                <div className="rounded-full border border-amber-400/30 bg-amber-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-amber-200">
                  Transparency verified
                </div>
              ) : null}

              {result.checkpointValid ? (
                <div className="rounded-full border border-violet-400/30 bg-violet-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-violet-200">
                  Checkpoint valid
                </div>
              ) : null}
            </div>

            <div className="mt-8 grid gap-6 md:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
                <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
                  Checksum
                </p>

                <p className="mt-3 break-all font-mono text-sm text-white">
                  {result.checksum || "Unavailable"}
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
                <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
                  Release state
                </p>

                <p className="mt-3 text-sm font-semibold text-white">
                  {result.releaseState || "Unavailable"}
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
                <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
                  Latest transparency entry
                </p>

                <p className="mt-3 break-all font-mono text-sm text-white">
                  {result.latestEntryHash || "Unavailable"}
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
                <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
                  Merkle root
                </p>

                <p className="mt-3 break-all font-mono text-sm text-white">
                  {result.merkleRoot || "Unavailable"}
                </p>
              </div>
            </div>

            {result.error ? (
              <div className="mt-6 rounded-2xl border border-rose-400/20 bg-rose-500/10 p-4 text-sm text-rose-100">
                {result.error}
              </div>
            ) : null}
          </section>
        ) : null}
      </div>
    </main>
  );
}

