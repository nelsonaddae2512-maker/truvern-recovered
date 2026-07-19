// components/vendor-assessments-panel.tsx
'use client';

import { useState, useTransition, FormEvent } from 'react';

type AssessmentLite = {
  id: number;
  createdAt: string; // ISO
  score: number | null;
  riskLevel: string | null;
  summary: string | null;
};

type Props = {
  vendorId: number;
  initialAssessments: AssessmentLite[];
};

export function VendorAssessmentsPanel({
  vendorId,
  initialAssessments,
}: Props) {
  const [assessments, setAssessments] = useState<AssessmentLite[]>(
    initialAssessments,
  );
  const [score, setScore] = useState<string>('');
  const [riskLevel, setRiskLevel] = useState<string>('Medium');
  const [summary, setSummary] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const sorted = assessments
    .slice()
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() -
        new Date(a.createdAt).getTime(),
    );

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const numericScore = Number(score);
    if (Number.isNaN(numericScore)) {
      setError('Score must be a number between 0 and 100.');
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch(`/api/vendors/${vendorId}/assessments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            score: numericScore,
            riskLevel,
            summary,
          }),
        });

        if (!res.ok) {
          let message = `Create failed (${res.status})`;
          try {
            const data = await res.json();
            if (data?.message || data?.error) {
              message = String(data.message || data.error);
            }
          } catch {
            // ignore
          }
          throw new Error(message);
        }

        const data: AssessmentLite = await res.json();

        setAssessments((prev) => [
          {
            id: data.id,
            createdAt: data.createdAt,
            score: data.score ?? numericScore,
            riskLevel: data.riskLevel ?? riskLevel,
            summary: data.summary ?? summary,
          },
          ...prev,
        ]);

        setScore('');
        setSummary('');
        setSuccess('Assessment recorded and risk score updated.');
      } catch (err: any) {
        console.error(err);
        setError(err?.message ?? 'Failed to record assessment.');
      }
    });
  }

  return (
    <section className="border rounded-lg px-4 py-4 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-medium">Assessments</h2>
      </div>

      {/* Form */}
      <form
        onSubmit={handleSubmit}
        className="grid gap-3 sm:grid-cols-3 sm:items-end"
      >
        <div className="space-y-1">
          <label className="text-xs uppercase tracking-wide text-muted-foreground">
            Score (0€“100)
          </label>
          <input
            type="number"
            min={0}
            max={100}
            value={score}
            onChange={(e) => setScore(e.target.value)}
            className="border rounded-md px-2 py-1.5 text-sm w-full"
            placeholder="e.g. 72"
            required
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs uppercase tracking-wide text-muted-foreground">
            Risk level
          </label>
          <select
            value={riskLevel}
            onChange={(e) => setRiskLevel(e.target.value)}
            className="border rounded-md px-2 py-1.5 text-sm w-full"
          >
            <option value="Low">Low</option>
            <option value="Medium">Medium</option>
            <option value="High">High</option>
            <option value="Pending">Pending</option>
          </select>
        </div>

        <div className="space-y-1 sm:col-span-3">
          <label className="text-xs uppercase tracking-wide text-muted-foreground">
            Summary / notes
          </label>
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            rows={2}
            className="border rounded-md px-2 py-1.5 text-sm w-full"
            placeholder="Short explanation of the assessment outcome€¦"
          />
        </div>

        <div className="sm:col-span-3">
          <button
            type="submit"
            disabled={isPending}
            className="text-xs border rounded-md px-3 py-1.5 hover:bg-muted transition-colors disabled:opacity-60"
          >
            {isPending ? 'Recording€¦' : 'Record assessment'}
          </button>
        </div>
      </form>

      {error && (
        <p className="text-xs text-red-600" role="alert">
          {error}
        </p>
      )}
      {success && (
        <p className="text-xs text-emerald-600" role="status">
          {success}
        </p>
      )}

      {/* Table */}
      {sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No assessments have been recorded for this vendor yet. When you start
          assessing this vendor, recent assessments will appear here.
        </p>
      ) : (
        <div className="overflow-x-auto border rounded-md">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/60">
              <tr className="text-left">
                <th className="px-4 py-2 font-medium">Assessment</th>
                <th className="px-4 py-2 font-medium">Score</th>
                <th className="px-4 py-2 font-medium">Risk level</th>
                <th className="px-4 py-2 font-medium">Summary</th>
                <th className="px-4 py-2 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((a) => (
                <tr key={a.id} className="border-t">
                  <td className="px-4 py-2">
                    Assessment #{a.id}
                  </td>
                  <td className="px-4 py-2">
                    {a.score == null ? '€”' : a.score}
                  </td>
                  <td className="px-4 py-2">
                    {a.riskLevel ?? 'Pending'}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {a.summary && a.summary.length > 80
                      ? a.summary.slice(0, 77) + '€¦'
                      : a.summary ?? '€”'}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {new Date(a.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}


