"use client";

import { useState, useTransition } from "react";

type Props = {
  assessmentId: number;
};

const actions = [
  ["score", "Score"],
  ["findings", "Generate findings"],
  ["remediation", "Request remediation"],
  ["attestations", "Request attestations"],
  ["release-ready", "Mark release-ready"],
  ["confirm-release", "Confirm release"],
] as const;

export default function FrameworkAssessmentActions({ assessmentId }: Props) {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pendingAction, setPendingAction] = useState("");
  const [pending, startTransition] = useTransition();

  function runAction(action: string, label: string) {
    setMessage("");
    setError("");
    setPendingAction(action);

    startTransition(async () => {
      const result = await fetch(`/api/truvern/framework-assessments/${assessmentId}/${action}`, {
        method: "POST",
      });

      const json = await result.json().catch(() => ({}));

      if (!result.ok || !json.ok) {
        setError(json.error ?? `${label} failed.`);
        setPendingAction("");
        return;
      }

      setMessage(`${label} complete.`);
      setPendingAction("");
      window.location.reload();
    });
  }

  return (
    <div className="mt-5">
      <div className="flex flex-wrap gap-2">
        {actions.map(([action, label]) => (
          <button
            key={action}
            type="button"
            disabled={pending}
            onClick={() => runAction(action, label)}
            className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1.5 text-xs font-semibold text-cyan-100 hover:bg-cyan-300/15 disabled:opacity-50"
          >
            {pending && pendingAction === action ? "Working..." : label}
          </button>
        ))}

        <a
          href={`/vendor-assessments/${assessmentId}`}
          className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/[0.09]"
        >
          Vendor workspace
        </a>

        <a
          href={`/api/truvern/framework-assessments/${assessmentId}/packet`}
          target="_blank"
          className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1.5 text-xs font-semibold text-emerald-100 hover:bg-emerald-300/15"
        >
          Packet
        </a>

        <a
          href={`/api/truvern/framework-assessments/${assessmentId}/packet/pdf`}
          target="_blank"
          className="rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1.5 text-xs font-semibold text-amber-100 hover:bg-amber-300/15"
        >
          PDF
        </a>

        <a
          href={`/api/truvern/framework-assessments/${assessmentId}/verify`}
          target="_blank"
          className="rounded-full border border-violet-300/20 bg-violet-300/10 px-3 py-1.5 text-xs font-semibold text-violet-100 hover:bg-violet-300/15"
        >
          Verify
        </a>

        <a
          href={`/api/truvern/framework-assessments/${assessmentId}/manifest`}
          target="_blank"
          className="rounded-full border border-fuchsia-300/20 bg-fuchsia-300/10 px-3 py-1.5 text-xs font-semibold text-fuchsia-100 hover:bg-fuchsia-300/15"
        >
          Manifest
        </a>
      </div>

      {message ? <p className="mt-3 text-sm text-emerald-300">{message}</p> : null}
      {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}
    </div>
  );
}




