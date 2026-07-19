"use client";

import { useRef, useState, useTransition } from "react";

type Props = {
  assessmentId: number;
  responseId: number;
};

type UploadRecord = {
  evidenceId: string;
  filename: string;
  key: string;
  contentType: string;
  sizeBytes: number | null;
};

export default function EvidenceUpload({ assessmentId, responseId }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploads, setUploads] = useState<UploadRecord[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function uploadSelectedFile() {
    const file = inputRef.current?.files?.[0];
    setMessage("");
    setError("");

    if (!file) {
      setError("Choose a file first.");
      return;
    }

    startTransition(async () => {
      const presignResult = await fetch(`/api/vendor-assessments/${assessmentId}/evidence/upload`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          responseId,
          filename: file.name,
          contentType: file.type || "application/octet-stream",
          sizeBytes: file.size,
        }),
      });

      const presignJson = await presignResult.json().catch(() => ({}));

      if (!presignResult.ok || !presignJson.ok) {
        setError(presignJson.error ?? "Could not create upload URL.");
        return;
      }

      const upload = presignJson.upload;

      const s3Result = await fetch(upload.uploadUrl, {
        method: upload.method ?? "PUT",
        headers: {
          "content-type": upload.contentType,
        },
        body: file,
      });

      if (!s3Result.ok) {
        setError("S3 upload failed. Try again or verify S3 CORS/settings.");
        return;
      }

      setUploads((current) => [
        {
          evidenceId: upload.evidenceId,
          filename: upload.filename,
          key: upload.key,
          contentType: upload.contentType,
          sizeBytes: upload.sizeBytes,
        },
        ...current,
      ]);

      setMessage("Evidence uploaded.");
      if (inputRef.current) inputRef.current.value = "";
    });
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Evidence file
          </p>
          <p className="mt-1 text-sm text-slate-400">
            Upload PDFs, screenshots, policies, reports, certifications, or spreadsheets.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            ref={inputRef}
            type="file"
            className="max-w-xs rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 text-xs text-slate-300 file:mr-3 file:rounded-full file:border-0 file:bg-cyan-500/15 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-cyan-100"
          />
          <button
            type="button"
            onClick={uploadSelectedFile}
            disabled={pending}
            className="rounded-2xl border border-cyan-400/30 bg-cyan-500/15 px-4 py-2 text-xs font-semibold text-cyan-50 hover:bg-cyan-500/20 disabled:opacity-50"
          >
            {pending ? "Uploading..." : "Upload"}
          </button>
        </div>
      </div>

      {message ? <p className="mt-3 text-sm text-emerald-300">{message}</p> : null}
      {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}

      {uploads.length ? (
        <div className="mt-4 space-y-2">
          {uploads.map((upload) => (
            <div key={upload.evidenceId} className="rounded-2xl border border-emerald-400/10 bg-emerald-400/5 p-3">
              <p className="text-sm font-semibold text-emerald-100">{upload.filename}</p>
              <p className="mt-1 break-all text-xs text-slate-500">{upload.key}</p>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

