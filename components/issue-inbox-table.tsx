// components/issue-inbox-table.tsx
"use client";

import Link from "next/link";

type IssueRow = {
  id: number;
  title: string;
  severity: string;
  status: string;
  vendor?: {
    id: number;
    name: string;
  } | null;
  assessment?: {
    id: number;
    title?: string | null;
  } | null;
  createdAt: string | Date;
};

type Props = {
  issues: IssueRow[];
  includeStatuses?: string[];
  emptyLabel?: string;
  showVendor?: boolean;

  // Phase 326C: selection
  selectable?: boolean;
  selectedIds?: Set<number>;
  onToggleOne?: (id: number) => void;
  onToggleAll?: (ids: number[], checked: boolean) => void;
};

function formatDate(value: string | Date) {
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function severityTone(sev: string) {
  switch (sev) {
    case "CRITICAL":
      return "text-rose-300";
    case "HIGH":
      return "text-amber-300";
    case "MEDIUM":
      return "text-cyan-300";
    default:
      return "text-slate-300";
  }
}

function statusTone(status: string) {
  switch (status) {
    case "OPEN":
      return "text-amber-300";
    case "IN_REVIEW":
      return "text-cyan-300";
    case "RESOLVED":
      return "text-emerald-300";
    case "ACCEPTED_RISK":
      return "text-violet-300";
    default:
      return "text-slate-300";
  }
}

export default function IssueInboxTable({
  issues,
  includeStatuses,
  emptyLabel = "No issues found.",
  showVendor = true,
  selectable = false,
  selectedIds,
  onToggleOne,
  onToggleAll,
}: Props) {
  const filtered =
    includeStatuses && includeStatuses.length
      ? (issues ?? []).filter((i) => includeStatuses.includes(String(i.status)))
      : issues ?? [];

  if (!filtered || filtered.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/60 px-4 py-6 text-sm text-slate-400">
        {emptyLabel}
      </div>
    );
  }

  const idsOnPage = filtered.map((i) => i.id);
  const selectedCount =
    selectable && selectedIds ? idsOnPage.filter((id) => selectedIds.has(id)).length : 0;

  const allChecked = selectable && filtered.length > 0 && selectedCount === filtered.length;
  const someChecked = selectable && selectedCount > 0 && selectedCount < filtered.length;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/80">
      <table className="w-full text-sm">
        <thead className="bg-slate-900/60 text-[11px] uppercase tracking-wider text-slate-400">
          <tr>
            {selectable ? (
              <th className="w-[44px] px-3 py-3 text-left">
                <input
                  type="checkbox"
                  checked={allChecked}
                  ref={(el) => {
                    if (el) el.indeterminate = !!someChecked;
                  }}
                  onChange={(e) => onToggleAll?.(idsOnPage, e.target.checked)}
                  className="h-4 w-4 rounded border-slate-700 bg-slate-950"
                  aria-label="Select all on page"
                />
              </th>
            ) : null}

            <th className="px-4 py-3 text-left">Issue</th>
            {showVendor ? <th className="px-4 py-3 text-left">Vendor</th> : null}
            <th className="px-4 py-3 text-left">Severity</th>
            <th className="px-4 py-3 text-left">Status</th>
            <th className="px-4 py-3 text-left">Created</th>
          </tr>
        </thead>

        <tbody>
          {filtered.map((issue) => {
            const checked = selectable && selectedIds ? selectedIds.has(issue.id) : false;

            return (
              <tr
                key={issue.id}
                className="group border-t border-slate-800 hover:bg-slate-900/70"
              >
                {selectable ? (
                  <td className="px-3 py-3 align-top">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => onToggleOne?.(issue.id)}
                      className="h-4 w-4 rounded border-slate-700 bg-slate-950"
                      aria-label={`Select issue ${issue.id}`}
                    />
                  </td>
                ) : null}

                <td className="px-4 py-3">
                  <Link
                    href={`/issues/${issue.id}`}
                    className="font-medium text-slate-100 hover:text-emerald-300"
                  >
                    {issue.title}
                  </Link>
                  {issue.assessment?.title ? (
                    <div className="text-[11px] text-slate-500">{issue.assessment.title}</div>
                  ) : null}
                </td>

                {showVendor ? (
                  <td className="px-4 py-3">
                    {issue.vendor ? (
                      <Link
                        href={`/vendors/${issue.vendor.id}`}
                        className="text-slate-300 hover:text-emerald-300"
                      >
                        {issue.vendor.name}
                      </Link>
                    ) : (
                      <span className="text-slate-500">€”</span>
                    )}
                  </td>
                ) : null}

                <td className="px-4 py-3">
                  <span className={`font-semibold ${severityTone(String(issue.severity))}`}>
                    {String(issue.severity)}
                  </span>
                </td>

                <td className="px-4 py-3">
                  <span className={`font-semibold ${statusTone(String(issue.status))}`}>
                    {String(issue.status)}
                  </span>
                </td>

                <td className="px-4 py-3 text-slate-400">{formatDate(issue.createdAt)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}


