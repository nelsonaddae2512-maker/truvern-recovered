import Link from "next/link";
import prisma from "@/lib/prisma";
import WorkflowQueueActions from "@/components/review-desk/workflow-queue-actions.client";
import ClaimNextWorkButton from "@/components/review-desk/claim-next-work-button.client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function badgeClass(queue: string) {
  if (queue === "EVIDENCE_WAITING_REVIEW") return "border-cyan-300/25 bg-cyan-400/10 text-cyan-100";
  if (queue === "VENDOR_WAITING_RESPONSE") return "border-amber-300/25 bg-amber-400/10 text-amber-100";
  if (queue === "READY_FOR_RELEASE_CHECK") return "border-emerald-300/25 bg-emerald-400/10 text-emerald-100";
  if (queue === "GOVERNANCE_RELEASE_READY") return "border-lime-300/25 bg-lime-400/10 text-lime-100";
  if (queue === "UNDER_TRUVERN_REVIEW") return "border-violet-300/25 bg-violet-400/10 text-violet-100";
  return "border-white/10 bg-white/[0.04] text-slate-200";
}

function formatQueue(value: string) {
  return String(value || "QUEUE").replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (m) => m.toUpperCase());
}
function slaLabel(value: unknown) {
  if (!value) return "No SLA date";

  const due = new Date(String(value));
  if (Number.isNaN(due.getTime())) return "No SLA date";

  const now = new Date();
  const days = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (days < 0) return `Overdue by ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"}`;
  if (days === 0) return "Due today";
  if (days <= 3) return `Due in ${days} day${days === 1 ? "" : "s"}`;

  return `Due in ${days} days`;
}

function slaClass(value: unknown) {
  if (!value) return "border-white/10 bg-white/[0.04] text-slate-300";

  const due = new Date(String(value));
  if (Number.isNaN(due.getTime())) return "border-white/10 bg-white/[0.04] text-slate-300";

  const now = new Date();
  const days = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (days < 0) return "border-rose-300/25 bg-rose-400/10 text-rose-100";
  if (days <= 3) return "border-amber-300/25 bg-amber-400/10 text-amber-100";

  return "border-emerald-300/25 bg-emerald-400/10 text-emerald-100";
}


type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>;
};

export default async function WorkflowQueuePage({ searchParams }: PageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const queueFilter = String(resolvedSearchParams.queue ?? "ALL");
  const ownerFilter = String(resolvedSearchParams.owner ?? "ALL");

  const summary = await prisma.$queryRawUnsafe<any[]>(`
    select queue, status, count(*)::int as count
    from "WorkflowQueueItem"
    group by queue, status
    order by queue asc, status asc
  `);

  const items = await prisma.$queryRawUnsafe<any[]>(`
    select
      qi.id,
      qi.queue,
      qi.status,
      qi.priority,
      qi."dueAt",
      qi."updatedAt",
      qi."assignedTo",
      qi.payload,
      rp.id as "packageId",
      rp.title as "packageTitle",
      rp.status as "packageStatus",
      rp.severity,
      v.name as "vendorName",
      o.name as "organizationName",
      qi."reviewAssignmentId"
    from "WorkflowQueueItem" qi
    left join "RemediationPackage" rp
      on qi.payload->>'remediationPackageId' = rp.id::text
    left join "Vendor" v
      on v.id = qi."vendorId"
    left join "Organization" o
      on o.id = qi."organizationId"
    where qi.status = 'OPEN'
    order by qi.priority desc, qi."dueAt" asc nulls last, qi."updatedAt" asc
    limit 100
  `);

  const filteredItems = items.filter((item) => {
    const queueMatches = queueFilter === "ALL" || item.queue === queueFilter;
    const ownerMatches =
      ownerFilter === "ALL" ||
      (ownerFilter === "UNCLAIMED" && !item.assignedTo) ||
      (ownerFilter === "MY_WORK" && item.assignedTo === "TRUVERN_REVIEWER");

    return queueMatches && ownerMatches;
  });

  const filterLinkClass = "rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-white/[0.08]";
  const activeFilterLinkClass = "rounded-full border border-cyan-300/25 bg-cyan-400/10 px-4 py-2 text-xs font-semibold text-cyan-100";

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-8 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-200">
              Truvern Workflow Queue
            </p>
            <h1 className="mt-3 text-3xl font-semibold">
              Reviewer operations queue
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
              Prioritized remediation packages waiting for vendor response, Truvern review, or release readiness.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <ClaimNextWorkButton />

            <Link
              href="/review-desk"
              className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-semibold text-white hover:bg-white/[0.08]"
            >
              Back to Review Desk
            </Link>
          </div>
        </div>

        <section className="mt-8 grid gap-4 md:grid-cols-4">
          {summary.map((row) => (
            <div key={`${row.queue}-${row.status}`} className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                {formatQueue(row.queue)}
              </p>
              <p className="mt-3 text-3xl font-semibold">{row.count}</p>
              <p className="mt-1 text-sm text-slate-400">{row.status}</p>
            </div>
          ))}
        </section>

        <section className="mt-8 rounded-3xl border border-white/10 bg-white/[0.03] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
            Queue filters
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/review-desk/workflow-queue" className={queueFilter === "ALL" && ownerFilter === "ALL" ? activeFilterLinkClass : filterLinkClass}>
              All work
            </Link>
            <Link href="/review-desk/workflow-queue?owner=UNCLAIMED" className={ownerFilter === "UNCLAIMED" ? activeFilterLinkClass : filterLinkClass}>
              Unclaimed
            </Link>
            <Link href="/review-desk/workflow-queue?owner=MY_WORK" className={ownerFilter === "MY_WORK" ? activeFilterLinkClass : filterLinkClass}>
              My work
            </Link>
            <Link href="/review-desk/workflow-queue?queue=EVIDENCE_WAITING_REVIEW" className={queueFilter === "EVIDENCE_WAITING_REVIEW" ? activeFilterLinkClass : filterLinkClass}>
              Evidence review
            </Link>
            <Link href="/review-desk/workflow-queue?queue=VENDOR_WAITING_RESPONSE" className={queueFilter === "VENDOR_WAITING_RESPONSE" ? activeFilterLinkClass : filterLinkClass}>
              Waiting vendor
            </Link>
            <Link href="/review-desk/workflow-queue?queue=READY_FOR_RELEASE_CHECK" className={queueFilter === "READY_FOR_RELEASE_CHECK" ? activeFilterLinkClass : filterLinkClass}>
              Release check
            </Link>
            <Link href="/review-desk/workflow-queue?queue=GOVERNANCE_RELEASE_READY" className={queueFilter === "GOVERNANCE_RELEASE_READY" ? activeFilterLinkClass : filterLinkClass}>
              Governance release
            </Link>
          </div>
        </section>

        <section className="mt-8 rounded-3xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Open work</h2>
            <span className="rounded-full border border-cyan-300/25 bg-cyan-400/10 px-3 py-1 text-xs font-semibold text-cyan-100">
              {filteredItems.length} shown
            </span>
          </div>

          <div className="mt-5 grid gap-3">
            {filteredItems.map((item) => (
              <div key={item.id} className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="flex flex-wrap gap-2">
                      <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${badgeClass(item.queue)}`}>
                        {formatQueue(item.queue)}
                      </span>
                      <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-semibold text-slate-300">
                        Priority {item.priority}
                      </span>
                      <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${slaClass(item.dueAt)}`}>
                        {slaLabel(item.dueAt)}
                      </span>
                      {item.payload?.orchestrator?.state ? (
                        <span className="rounded-full border border-violet-300/20 bg-violet-400/10 px-3 py-1 text-xs font-semibold text-violet-100">
                          {String(item.payload.orchestrator.state).replaceAll("_", " ")}
                        </span>
                      ) : null}
                      {item.severity ? (
                        <span className="rounded-full border border-amber-300/20 bg-amber-400/10 px-3 py-1 text-xs font-semibold text-amber-100">
                          {item.severity}
                        </span>
                      ) : null}

                      {item.assignedTo ? (
                        <span className="rounded-full border border-violet-300/20 bg-violet-400/10 px-3 py-1 text-xs font-semibold text-violet-100">
                          Claimed
                        </span>
                      ) : (
                        <span className="rounded-full border border-slate-300/10 bg-white/[0.04] px-3 py-1 text-xs font-semibold text-slate-300">
                          Unclaimed
                        </span>
                      )}

                      {item.assignedTo ? (
                        <span className="rounded-full border border-violet-300/20 bg-violet-400/10 px-3 py-1 text-xs font-semibold text-violet-100">
                          Claimed
                        </span>
                      ) : (
                        <span className="rounded-full border border-slate-300/10 bg-white/[0.04] px-3 py-1 text-xs font-semibold text-slate-300">
                          Unclaimed
                        </span>
                      )}
                    </div>

                    <h3 className="mt-3 text-lg font-semibold">
                      {item.packageTitle || "Remediation package"}
                    </h3>

                    <p className="mt-1 text-sm text-slate-400">
                      {item.vendorName || "Vendor"} · {item.organizationName || "Organization"} · Status: {item.packageStatus || "Not recorded"}
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      {item.assignedTo ? `Assigned to ${item.payload?.assignedReviewerName || item.assignedTo}` : "Unassigned"}
                      {item.assignedTo ? ` · Claimed by ${item.payload?.assignedReviewerName || item.assignedTo}` : " · Unclaimed"}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <WorkflowQueueActions
                      queueItemId={Number(item.id)}
                      assignedTo={item.assignedTo}
                    />

                    {item.reviewAssignmentId ? (
                      <Link
                        href={`/review-desk/${item.reviewAssignmentId}`}
                        className="rounded-full border border-cyan-300/25 bg-cyan-400/10 px-4 py-2 text-xs font-semibold text-cyan-100 hover:bg-cyan-400/20"
                      >
                        Open review
                      </Link>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}

            {filteredItems.length === 0 ? (
              <p className="rounded-2xl border border-white/10 bg-black/20 p-5 text-sm text-slate-300">
                No open workflow queue items.
              </p>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}









