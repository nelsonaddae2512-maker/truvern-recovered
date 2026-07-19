// components/vendor-issues-panel.tsx
'use client';

import { useState } from 'react';

type Issue = {
  id: number;
  title: string;
  severity: string;
  status: string;
  dueDate: string | null;
};

type Props = {
  vendorId: number;
  initialIssues: Issue[];
};

export function VendorIssuesPanel({ vendorId, initialIssues }: Props) {
  const [issues, setIssues] = useState<Issue[]>(initialIssues || []);
  const [title, setTitle] = useState('');
  const [severity, setSeverity] = useState('Low');
  const [dueDate, setDueDate] = useState('');

  async function createIssue() {
    if (!title.trim()) return;

    const res = await fetch(`/api/vendors/${vendorId}/issues`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, severity, dueDate }),
    });

    if (!res.ok) {
      alert('Failed to create issue');
      return;
    }

    const newIssue = await res.json();
    setIssues((prev) => [
      {
        id: newIssue.id,
        title: newIssue.title,
        severity: newIssue.severity,
        status: newIssue.status,
        dueDate: newIssue.dueDate
          ? new Date(newIssue.dueDate).toISOString()
          : null,
      },
      ...prev,
    ]);
    setTitle('');
    setDueDate('');
  }

  async function updateStatus(id: number, status: string) {
    const res = await fetch(`/api/issues/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });

    if (!res.ok) return;

    const updated = await res.json();

    setIssues((prev) =>
      prev.map((i) =>
        i.id === id
          ? {
              ...i,
              status: updated.status,
            }
          : i,
      ),
    );
  }

  return (
    <section className="border rounded-lg px-4 py-4 space-y-4">
      <h2 className="text-lg font-medium">Issues</h2>

      {/* Create Issue */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <input
          className="border rounded px-2 py-1.5 text-sm"
          placeholder="Issue title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <select
          className="border rounded px-2 py-1.5 text-sm"
          value={severity}
          onChange={(e) => setSeverity(e.target.value)}
        >
          <option>Low</option>
          <option>Medium</option>
          <option>High</option>
        </select>
        <input
          type="date"
          className="border rounded px-2 py-1.5 text-sm"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
        />
      </div>

      <button
        onClick={createIssue}
        className="text-xs border rounded-md px-3 py-1.5 hover:bg-muted transition-colors"
      >
        Add Issue
      </button>

      {/* Issues Table */}
      {issues.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No issues have been logged for this vendor yet.
        </p>
      ) : (
        <div className="overflow-x-auto border rounded-md mt-4">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/60">
              <tr>
                <th className="p-3 text-left font-medium">Title</th>
                <th className="p-3 font-medium">Severity</th>
                <th className="p-3 font-medium">Status</th>
                <th className="p-3 font-medium">Due</th>
                <th className="p-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {issues.map((issue) => (
                <tr key={issue.id} className="border-t">
                  <td className="p-3 text-left">{issue.title}</td>
                  <td className="p-3 text-center">{issue.severity}</td>
                  <td className="p-3 text-center">{issue.status}</td>
                  <td className="p-3 text-center">
                    {issue.dueDate
                      ? new Date(issue.dueDate).toLocaleDateString()
                      : '€”'}
                  </td>
                  <td className="p-3 text-center space-x-2">
                    <button
                      className="text-xs text-amber-700 underline"
                      onClick={() => updateStatus(issue.id, 'In progress')}
                    >
                      Start
                    </button>
                    <button
                      className="text-xs text-emerald-700 underline"
                      onClick={() => updateStatus(issue.id, 'Closed')}
                    >
                      Close
                    </button>
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


