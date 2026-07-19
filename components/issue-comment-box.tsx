"use client";

import { useState } from "react";

type Props = {
  issueId: number;
  byDefault?: string;
};

export default function IssueCommentBox({ issueId, byDefault }: Props) {
  const [comment, setComment] = useState("");
  const [by, setBy] = useState(byDefault || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const text = comment.trim();
    if (!text) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/issues/${issueId}/comment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment: text, by: by.trim() }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Failed to post comment");

      setComment("");
      window.location.reload();
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
      <div className="text-sm font-medium text-slate-200">Add comment</div>

      <div className="mt-3 grid gap-3">
        <input
          value={by}
          onChange={(e) => setBy(e.target.value)}
          placeholder="By (optional) e.g. nelson@truvern.com"
          className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-emerald-500/30"
        />

        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Write a note€¦"
          rows={4}
          className="w-full resize-none rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-emerald-500/30"
        />

        <div className="flex items-center justify-between gap-3">
          {error ? <div className="text-xs text-rose-300">{error}</div> : <div />}

          <button
            onClick={submit}
            disabled={loading || comment.trim().length === 0}
            className="rounded-xl bg-emerald-500/15 px-4 py-2 text-sm text-emerald-200 ring-1 ring-emerald-500/20 hover:bg-emerald-500/20 disabled:opacity-50"
          >
            {loading ? "Posting€¦" : "Post comment"}
          </button>
        </div>
      </div>
    </div>
  );
}


