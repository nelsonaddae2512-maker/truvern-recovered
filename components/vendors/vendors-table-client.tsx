"use client";

import Link from "next/link";

function clsx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

type Row = {
  id: number;
  name: string;
  category?: string | null;
  updatedAt?: any;
  contactEmail?: string | null;
  _count?: {
    assessments?: number;
    issues?: number;
    evidence?: number;
    evidenceRequests?: number;
  };
};

export default function VendorsTableClient({ rows }: { rows: Row[] }) {
  return (
    <div className="glass-soft rounded-2xl border border-white/10 overflow-hidden">
      <div className="grid grid-cols-[1.5fr_0.8fr_0.8fr_0.8fr_0.8fr_0.6fr] gap-3 px-5 py-3 text-xs font-semibold tracking-wide text-muted-foreground">
        <div>VENDOR</div>
        <div>CONTACT</div>
        <div>ASSESS</div>
        <div>ISSUES</div>
        <div>EVIDENCE</div>
        <div className="text-right">ACTIONS</div>
      </div>

      <div className="divide-y divide-white/10">
        {rows.map((r) => {
          const hasEmail = !!(r.contactEmail && r.contactEmail.trim());
          return (
            <div
              key={r.id}
              className="grid grid-cols-[1.5fr_0.8fr_0.8fr_0.8fr_0.8fr_0.6fr] gap-3 px-5 py-4"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <Link href={`/vendors/${r.id}`} className="font-semibold truncate hover:underline">
                    {r.name}
                  </Link>
                  <span
                    className={clsx(
                      "text-[11px] rounded-full px-2 py-0.5 border whitespace-nowrap",
                      hasEmail
                        ? "border-emerald-400/30 text-emerald-200"
                        : "border-amber-400/30 text-amber-200"
                    )}
                  >
                    {hasEmail ? "Email set" : "Missing email"}
                  </span>
                </div>
                {r.category ? <div className="text-xs text-muted-foreground">{r.category}</div> : null}
              </div>

              <div className="text-sm text-muted-foreground truncate">
                {hasEmail ? r.contactEmail : "€”"}
              </div>

              <div className="text-sm">{r._count?.assessments ?? "€”"}</div>
              <div className="text-sm">{r._count?.issues ?? "€”"}</div>
              <div className="text-sm">{r._count?.evidence ?? "€”"}</div>

              <div className="flex justify-end">
                <Link className="btn-glass" href={`/vendors/${r.id}`}>
                  View
                </Link>
              </div>
            </div>
          );
        })}

        {rows.length === 0 ? (
          <div className="px-5 py-10 text-sm text-muted-foreground">No vendors yet.</div>
        ) : null}
      </div>
    </div>
  );
}



