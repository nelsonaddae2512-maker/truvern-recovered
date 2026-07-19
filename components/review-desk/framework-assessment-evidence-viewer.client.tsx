"use client";

import { useState, useTransition } from "react";

type Props = {
  assessmentId: number;
};

type EvidenceFile = {
  evidenceId: string;
  filename: string;
  key: string;
  scope: string;
  contentType?: string;
  sizeBytes?: number | null;
  controlId?: string;
  controlTitle?: string;
  prompt?: string;
  findingTitle?: string;
  attestationTitle?: string;
  downloadUrl?: string | null;
};

export default function FrameworkAssessmentEvidenceViewer({ assessmentId }: Props) {
  const [evidence, setEvidence] = useState<EvidenceFile[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function loadEvidence() {
    setError("");

    startTransition(async () => {
      const result = await fetch(`/api/truvern/framework-assessments/${assessmentId}/evidence`);
      const json = await result.json().catch(() => ({}));

      if (!result.ok || !json.ok) {
        setError(json.error ?? "Could not load evidence.");
        return;
      }

      setEvidence(json.evidence ?? []);
      setLoaded(true);
    });
  }

  return (
    <div className="mt-4 rounded-3xl border border-white/10 bg-black/20 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Reviewer evidence
          </p>
          <p className="mt-1 text-sm text-slate-400">
            Load private S3 evidence links for reviewer inspection.
          </p>
        </div>

        <button
          type="button"
          onClick={loadEvidence}
          disabled={pending}
          className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1.5 text-xs font-semibold text-emerald-100 hover:bg-emerald-300/15 disabled:opacity-50"
        >
          {pending ? "Loading..." : loaded ? "Refresh evidence" : "Load evidence"}
        </button>
      </div>

      {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}

      {loaded ? (
        evidence.length ? (
          <div className="mt-4 space-y-3">
            {evidence.map((file) => (
              <div key={file.evidenceId} className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-100">
                        {file.scope}
                      </span>
                      {file.controlId ? (
                        <span className="rounded-full border border-white/10 bg-white/[0.05] px-2 py-1 text-[10px] text-slate-300">
                          {file.controlId}
                        </span>
                      ) : null}
                    </div>

                    <p className="mt-3 text-sm font-semibold text-white">{file.filename}</p>
                    <p className="mt-1 break-all text-xs text-slate-500">{file.key}</p>

                    {file.prompt ? <p className="mt-2 text-xs text-slate-400">{file.prompt}</p> : null}
                    {file.findingTitle ? <p className="mt-2 text-xs text-slate-400">{file.findingTitle}</p> : null}
                    {file.attestationTitle ? <p className="mt-2 text-xs text-slate-400">{file.attestationTitle}</p> : null}
                  </div>

                  {file.downloadUrl ? (
                    <a
                      href={file.downloadUrl}
                      target="_blank"
                      className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1.5 text-xs font-semibold text-cyan-100 hover:bg-cyan-300/15"
                    >
                      Download
                    </a>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-400">No uploaded evidence found yet.</p>
        )
      ) : null}
    </div>
  );
}

