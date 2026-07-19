"use client";

import { useState, useTransition } from "react";

type Props = {
  assessmentId: number;
};

type AuditEvent = {
  id: number;
  actorUserId: string | null;
  action: string;
  message: string | null;
  metadata: unknown;
  createdAt: string;
};

function formatAction(action: string) {
  return action.replaceAll("_", " ").toLowerCase();
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown time";

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export default function FrameworkAssessmentAuditLog({ assessmentId }: Props) {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function loadAudit() {
    setError("");

    startTransition(async () => {
      const result = await fetch(`/api/truvern/framework-assessments/${assessmentId}/audit`);
      const json = await result.json().catch(() => ({}));

      if (!result.ok || !json.ok) {
        setError(json.error ?? "Could not load audit trail.");
        return;
      }

      setEvents(json.events ?? []);
      setLoaded(true);
    });
  }

  return (
    <div className="mt-4 rounded-3xl border border-white/10 bg-black/20 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Governance audit trail
          </p>
          <p className="mt-1 text-sm text-slate-400">
            Review scored, remediation, attestation, evidence, and release events.
          </p>
        </div>

        <button
          type="button"
          onClick={loadAudit}
          disabled={pending}
          className="rounded-full border border-violet-300/20 bg-violet-300/10 px-3 py-1.5 text-xs font-semibold text-violet-100 hover:bg-violet-300/15 disabled:opacity-50"
        >
          {pending ? "Loading..." : loaded ? "Refresh audit" : "Load audit"}
        </button>
      </div>

      {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}

      {loaded ? (
        events.length ? (
          <div className="mt-4 space-y-3">
            {events.map((event) => (
              <div key={event.id} className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold capitalize text-white">
                      {formatAction(event.action)}
                    </p>
                    {event.message ? (
                      <p className="mt-1 text-sm text-slate-400">{event.message}</p>
                    ) : null}
                  </div>
                  <p className="text-xs text-slate-500">{formatDate(event.createdAt)}</p>
                </div>

                {event.actorUserId ? (
                  <p className="mt-2 text-xs text-slate-500">Actor: {event.actorUserId}</p>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-400">No audit events found yet.</p>
        )
      ) : null}
    </div>
  );
}

