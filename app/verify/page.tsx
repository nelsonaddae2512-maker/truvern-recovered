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
  const [frameworkBundleInput, setFrameworkBundleInput] =
    useState("");

  const [frameworkLoading, setFrameworkLoading] =
    useState(false);

  const [frameworkResult, setFrameworkResult] =
    useState<any | null>(null);

  const parsedFrameworkBundle =
    useMemo(
      () =>
        safeJsonParse(
          frameworkBundleInput,
        ),
      [frameworkBundleInput],
    );

  async function readFrameworkBundleFile(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file =
      event.target.files?.[0];

    if (!file) {
      return;
    }

    setFrameworkResult(
      null,
    );

    try {
      const text =
        await file.text();

      setFrameworkBundleInput(
        text,
      );
    }
    catch {
      setFrameworkBundleInput(
        "",
      );

      setFrameworkResult({
        ok:
          false,

        verified:
          false,

        error:
          "Unable to read the selected verification bundle.",
      });
    }
  }

  async function runFrameworkVerification() {
    setFrameworkLoading(
      true,
    );

    setFrameworkResult(
      null,
    );

    try {
      if (
        !parsedFrameworkBundle
      ) {
        setFrameworkResult({
          ok:
            false,

          verified:
            false,

          error:
            "Select or paste a valid Truvern framework verification bundle.",
        });

        return;
      }

      const response =
        await fetch(
          "/api/governance/framework-public-verify",
          {
            method:
              "POST",

            headers: {
              "content-type":
                "application/json",
            },

            body:
              JSON.stringify({
                bundle:
                  parsedFrameworkBundle,
              }),
          },
        );

      const data =
        await response.json();

      setFrameworkResult(
        data,
      );
    }
    catch (error: any) {
      setFrameworkResult({
        ok:
          false,

        verified:
          false,

        error:
          typeof error?.message === "string"
            ? error.message
            : "Framework release verification failed.",
      });
    }
    finally {
      setFrameworkLoading(
        false,
      );
    }
  }

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

        <section className="mt-12 rounded-3xl border border-cyan-400/20 bg-cyan-500/[0.06] p-6 md:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="inline-flex rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-cyan-200">
                RSA-SHA256 framework release
              </div>

              <h2 className="mt-4 text-2xl font-semibold text-white">
                Framework release verification bundle
              </h2>

              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">
                Upload or paste a portable Truvern framework verification bundle.
                Truvern verifies its immutable release snapshot, SHA-256 checksum,
                historical signing key fingerprint, payload hash, and detached
                RSA-SHA256 signature.
              </p>
            </div>

            <div className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-200">
              Offline-verifiable
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <label className="cursor-pointer rounded-2xl border border-cyan-300/25 bg-cyan-400/10 px-5 py-3 text-sm font-semibold text-cyan-50 transition hover:bg-cyan-400/15">
              Upload verification bundle
              <input
                type="file"
                accept=".json,application/json"
                onChange={readFrameworkBundleFile}
                className="hidden"
              />
            </label>

            <button
              type="button"
              onClick={runFrameworkVerification}
              disabled={frameworkLoading}
              className="rounded-2xl border border-emerald-400/30 bg-emerald-500/15 px-5 py-3 text-sm font-semibold text-emerald-50 transition hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {frameworkLoading
                ? "Verifying framework release..."
                : "Verify framework release"}
            </button>
          </div>

          <textarea
            value={frameworkBundleInput}
            onChange={(event) =>
              setFrameworkBundleInput(
                event.target.value,
              )
            }
            spellCheck={false}
            placeholder="Upload or paste a Truvern framework verification bundle JSON..."
            className="mt-5 h-[260px] w-full rounded-2xl border border-white/10 bg-black/30 p-4 font-mono text-xs text-slate-100 outline-none transition focus:border-cyan-400/40"
          />

          {frameworkResult ? (
            <div
              className={`mt-6 rounded-2xl border p-5 ${
                frameworkResult.verified
                  ? "border-emerald-400/30 bg-emerald-500/10"
                  : "border-rose-400/30 bg-rose-500/10"
              }`}
            >
              <div className="flex flex-wrap items-center gap-3">
                <div
                  className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] ${
                    frameworkResult.verified
                      ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
                      : "border-rose-400/30 bg-rose-500/10 text-rose-200"
                  }`}
                >
                  {frameworkResult.verified
                    ? "Cryptographically valid"
                    : "Invalid or unverifiable"}
                </div>

                {frameworkResult.cryptographicVerified ? (
                  <div className="rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">
                    RSA signature valid
                  </div>
                ) : null}

                {frameworkResult.checksumVerified ? (
                  <div className="rounded-full border border-violet-400/30 bg-violet-500/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-violet-200">
                    Checksum valid
                  </div>
                ) : null}

                {frameworkResult.publicKeyFingerprintVerified ? (
                  <div className="rounded-full border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-amber-200">
                    Public key matched
                  </div>
                ) : null}
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                    Signing key
                  </p>
                  <p className="mt-2 break-all font-mono text-xs text-white">
                    {frameworkResult.keyId || "Unavailable"}
                  </p>
                </div>

                <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                    Algorithm
                  </p>
                  <p className="mt-2 font-mono text-xs text-white">
                    {frameworkResult.algorithm || "Unavailable"}
                  </p>
                </div>

                <div className="rounded-xl border border-white/10 bg-black/20 p-4 md:col-span-2">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                    Calculated checksum
                  </p>
                  <p className="mt-2 break-all font-mono text-xs text-white">
                    {frameworkResult.calculatedChecksum || "Unavailable"}
                  </p>
                </div>
              </div>

              {!frameworkResult.verified &&
              (frameworkResult.error || frameworkResult.reason) ? (
                <p className="mt-4 text-sm leading-6 text-rose-100">
                  {frameworkResult.error ||
                    frameworkResult.reason}
                </p>
              ) : null}
            </div>
          ) : null}
        </section>

        <div className="mt-10 border-t border-white/10 pt-10">
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
              Legacy governance verifier
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Existing Ed25519 governance bundles, manifests, transparency proofs,
              and checkpoint verification remain supported below.
            </p>
          </div>
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

