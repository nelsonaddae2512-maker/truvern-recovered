"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { isOverdue } from "@/lib/issue-sla";

type UserLite = { id: number; name: string | null; email: string };
type Issue = any;

function chip(tone: string, text: string) {
  return (
    <span className={"inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold " + tone}>
      {text}
    </span>
  );
}

function fmtDate(d: any) {
  if (!d) return "€”";
  const dt = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(dt.getTime())) return "€”";
  return dt.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function severityTone(sev: string) {
  switch (sev) {
    case "CRITICAL":
      return "border-rose-500/50 bg-rose-500/10 text-rose-200";
    case "HIGH":
      return "border-amber-500/50 bg-amber-500/10 text-amber-200";
    case "MEDIUM":
      return "border-cyan-500/40 bg-cyan-500/10 text-cyan-200";
    default:
      return "border-slate-700 bg-slate-900/60 text-slate-200";
  }
}

function statusTone(st: string) {
  switch (st) {
    case "OPEN":
      return "border-amber-500/50 bg-amber-500/10 text-amber-200";
    case "IN_REVIEW":
      return "border-cyan-500/40 bg-cyan-500/10 text-cyan-200";
    case "RESOLVED":
      return "border-emerald-500/40 bg-emerald-500/10 text-emerald-200";
    case "ACCEPTED_RISK":
      return "border-violet-500/40 bg-violet-500/10 text-violet-200";
    default:
      return "border-slate-700 bg-slate-900/60 text-slate-200";
  }
}

export default function IssueDetailClient({ initialIssue }: { initialIssue: Issue }) {
  const [issue, setIssue] = useState<Issue>(initialIssue);
  const [users, setUsers] = useState<UserLite[]>([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const overdue = useMemo(
    () => isOverdue(issue?.dueAt, issue?.status),
    [issue?.dueAt, issue?.status]
  );

  useEffect(() => {
    let cancelled = false;
    async function loadUsers() {
      try {
        const r = await fetch("/api/users", { cache: "no-store" });
        const data = await r.json().catch(() => null);
        if (cancelled) return;
        setUsers(Array.isArray(data?.users) ? data.users : []);
      } catch {
        if (!cancelled) setUsers([]);
      }
    }
    loadUsers();
    return () => {
      cancelled = true;
    };
  }, []);

  async function patch(body: any) {
    setErr(null);
    setSaving(true);
    try {
      const r = await fetch(`/api/issues/${issue.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await r.json().catch(() => null);
      if (!r.ok || !data?.ok) throw new Error(data?.error ?? `HTTP ${r.status}`);
      setIssue(data.issue);
    } catch (e: any) {
      setErr(e?.message ?? "Update failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] gap-5">
      {/* Main */}
      <section className="rounded-3xl border border-slate-800 bg-slate-950/60 p-5 shadow-lg shadow-black/40">
        <div className="flex flex-wrap items-center gap-2">
          {chip(statusTone(issue.status), issue.status)}
          {chip(severityTone(issue.severity), issue.severity)}
          {overdue ? chip("border-rose-500/50 bg-rose-500/10 text-rose-200", "OVERDUE") : null}
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-xs text-slate-400">Status</div>
            <select
              className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-slate-100"
              value={issue.status}
              disabled={saving}
              onChange={(e) => patch({ status: e.target.value })}
            >
              <option value="OPEN">OPEN</option>
              <option value="IN_REVIEW">IN_REVIEW</option>
              <option value="RESOLVED">RESOLVED</option>
              <option value="ACCEPTED_RISK">ACCEPTED_RISK</option>
            </select>
          </div>

          <div>
            <div className="text-xs text-slate-400">Severity</div>
            <select
              className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-slate-100"
              value={issue.severity}
              disabled={saving}
              onChange={(e) => patch({ severity: e.target.value })}
            >
              <option value="LOW">LOW</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="HIGH">HIGH</option>
              <option value="CRITICAL">CRITICAL</option>
            </select>
          </div>

          <div>
            <div className="text-xs text-slate-400">Assignee</div>
            <select
              className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-slate-100"
              value={issue.assignedToId ?? ""}
              disabled={saving}
              onChange={(e) => patch({ assignedToId: e.target.value ? Number(e.target.value) : null })}
            >
              <option value="">Unassigned</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name ? `${u.name} (${u.email})` : u.email}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="text-xs text-slate-400">Due date</div>
            <input
              type="date"
              className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-slate-100"
              disabled={saving}
              value={issue.dueAt ? new Date(issue.dueAt).toISOString().slice(0, 10) : ""}
              onChange={(e) => patch({ dueAt: e.target.value ? new Date(e.target.value).toISOString() : null })}
            />
          </div>
        </div>

        <div className="mt-4">
          <div className="text-xs text-slate-400">Description</div>
          <textarea
            className="mt-1 w-full rounded-2xl border border-slate-800 bg-slate-900 px-3 py-2 text-slate-100"
            rows={4}
            defaultValue={issue.description ?? ""}
            disabled={saving}
            onBlur={(e) => patch({ description: e.target.value })}
            placeholder="Add remediation details, reproduction steps, or evidence guidance€¦"
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {issue.vendorId ? (
            <Link
              href={`/vendors/${issue.vendorId}#findings`}
              className="rounded-full border border-slate-800 bg-slate-950/60 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-900"
            >
              View in Vendor Findings †—
            </Link>
          ) : null}

          {issue.assessmentId ? (
            <Link
              href={`/assessment/runs/${issue.assessmentId}`}
              className="rounded-full border border-slate-800 bg-slate-950/60 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-900"
            >
              Go to Assessment Run †—
            </Link>
          ) : null}
        </div>

        {err ? <div className="mt-3 text-xs text-rose-200">Update error: {err}</div> : null}
      </section>

      {/* Timeline */}
      <aside className="rounded-3xl border border-slate-800 bg-slate-950/60 p-5 shadow-lg shadow-black/40">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-slate-100">Audit timeline</div>
            <div className="text-xs text-slate-500">Every change is recorded.</div>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          {(issue.events ?? []).map((ev: any) => (
            <div key={ev.id} className="rounded-2xl border border-slate-800 bg-slate-950 px-3 py-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs font-semibold text-slate-200">{ev.type}</div>
                <div className="text-[10px] text-slate-500">
                  {fmtDate(ev.createdAt)}
                </div>
              </div>
              {ev.payload ? (
                <pre className="mt-2 text-[11px] text-slate-300 whitespace-pre-wrap break-words opacity-90">
                  {JSON.stringify(ev.payload, null, 2)}
                </pre>
              ) : null}
            </div>
          ))}

          <div className="mt-3">
            <div className="text-xs text-slate-400">Add comment</div>
            <textarea
              className="mt-1 w-full rounded-2xl border border-slate-800 bg-slate-900 px-3 py-2 text-slate-100"
              rows={3}
              disabled={saving}
              placeholder="Add an update (triage notes, vendor response, remediation steps)€¦"
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                  const target = e.target as HTMLTextAreaElement;
                  const text = target.value.trim();
                  if (!text) return;
                  patch({ comment: text });
                  target.value = "";
                }
              }}
              onBlur={(e) => {
                const text = e.target.value.trim();
                if (!text) return;
                patch({ comment: text });
                e.target.value = "";
              }}
            />
            <div className="mt-1 text-[10px] text-slate-500">
              Tip: Ctrl/Œ˜ + Enter to save instantly.
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}


