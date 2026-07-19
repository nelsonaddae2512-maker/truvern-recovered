import Link from "next/link";
import prisma from "@/lib/prisma";
import WorkflowTaskActions from "@/components/review-desk/workflow-task-actions.client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>;
};

function label(value: string) {
  return String(value || "")
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function badgeClass(type: string) {
  if (type === "EVIDENCE_REVIEW") return "border-cyan-300/25 bg-cyan-400/10 text-cyan-100";
  if (type === "ATTESTATION_REVIEW") return "border-violet-300/25 bg-violet-400/10 text-violet-100";
  if (type === "AI_PRE_REVIEW") return "border-emerald-300/25 bg-emerald-400/10 text-emerald-100";
  if (type === "PACKAGE_DECISION") return "border-amber-300/25 bg-amber-400/10 text-amber-100";
  return "border-white/10 bg-white/[0.04] text-slate-200";
}

export default async function WorkflowTasksPage({ searchParams }: PageProps) {
  const resolved = searchParams ? await searchParams : {};
  const typeFilter = String(resolved.type ?? "ALL");
  const ownerFilter = String(resolved.owner ?? "ALL");

  const summary = await prisma.$queryRawUnsafe<any[]>(`
    select type, status, count(*)::int as count
    from "WorkflowTask"
    group by type, status
    order by type, status
  `);

  const tasks = await prisma.$queryRawUnsafe<any[]>(`
    select
      wt.id,
      wt.type,
      wt.title,
      wt.description,
      wt.status,
      wt.priority,
      wt."assignedTo",
      wt."assignedReviewerName",
      wt."estimatedMinutes",
      wt."slaDueAt",
      wt."packageId",
      wt."reviewAssignmentId",
      rp.title as "packageTitle",
      rp.status as "packageStatus",
      v.name as "vendorName",
      o.name as "organizationName"
    from "WorkflowTask" wt
    left join "RemediationPackage" rp on rp.id = wt."packageId"
    left join "Vendor" v on v.id = wt."vendorId"
    left join "Organization" o on o.id = wt."organizationId"
    where wt.status <> 'CANCELLED'
    order by
      case when wt.status = 'OPEN' then 0 when wt.status = 'IN_PROGRESS' then 1 else 2 end,
      wt.priority desc,
      wt."slaDueAt" asc nulls last,
      wt."updatedAt" asc
    limit 250
  `);

  const filteredTasks = tasks.filter((task) => {
    const typeMatches = typeFilter === "ALL" || task.type === typeFilter;
    const ownerMatches =
      ownerFilter === "ALL" ||
      (ownerFilter === "UNASSIGNED" && !task.assignedTo) ||
      (ownerFilter === "MY_TASKS" && task.assignedTo === "TRUVERN_REVIEWER");

    return typeMatches && ownerMatches;
  });

  const linkBase = "rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-white/[0.08]";
  const linkActive = "rounded-full border border-cyan-300/25 bg-cyan-400/10 px-4 py-2 text-xs font-semibold text-cyan-100";

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-8 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-200">
              Truvern Workflow Task Queue
            </p>
            <h1 className="mt-3 text-3xl font-semibold">Reviewer task operations</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
              Atomic review tasks generated from remediation packages, evidence, attestations, AI pre-review, and package decision work.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link href="/review-desk/workflow-queue" className="rounded-2xl border border-cyan-300/25 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-100 hover:bg-cyan-400/20">
              Workflow queue
            </Link>
            <Link href="/truvern/ops/command-center" className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-semibold text-white hover:bg-white/[0.08]">
              Command Center
            </Link>
          </div>
        </div>

        <section className="mt-8 grid gap-4 md:grid-cols-4">
          {summary.map((row) => (
            <div key={`${row.type}-${row.status}`} className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{label(row.type)}</p>
              <p className="mt-3 text-3xl font-semibold">{row.count}</p>
              <p className="mt-1 text-sm text-slate-400">{label(row.status)}</p>
            </div>
          ))}
        </section>

        <section className="mt-8 rounded-3xl border border-white/10 bg-white/[0.03] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Task filters</p>

          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/review-desk/tasks" className={typeFilter === "ALL" && ownerFilter === "ALL" ? linkActive : linkBase}>All tasks</Link>
            <Link href="/review-desk/tasks?owner=UNASSIGNED" className={ownerFilter === "UNASSIGNED" ? linkActive : linkBase}>Unassigned</Link>
            <Link href="/review-desk/tasks?owner=MY_TASKS" className={ownerFilter === "MY_TASKS" ? linkActive : linkBase}>My tasks</Link>
            <Link href="/review-desk/tasks?type=EVIDENCE_REVIEW" className={typeFilter === "EVIDENCE_REVIEW" ? linkActive : linkBase}>Evidence</Link>
            <Link href="/review-desk/tasks?type=ATTESTATION_REVIEW" className={typeFilter === "ATTESTATION_REVIEW" ? linkActive : linkBase}>Attestations</Link>
            <Link href="/review-desk/tasks?type=AI_PRE_REVIEW" className={typeFilter === "AI_PRE_REVIEW" ? linkActive : linkBase}>AI pre-review</Link>
            <Link href="/review-desk/tasks?type=PACKAGE_DECISION" className={typeFilter === "PACKAGE_DECISION" ? linkActive : linkBase}>Decision</Link>
          </div>
        </section>

        <section className="mt-8 rounded-3xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Open task work</h2>
            <span className="rounded-full border border-cyan-300/25 bg-cyan-400/10 px-3 py-1 text-xs font-semibold text-cyan-100">
              {filteredTasks.length} shown
            </span>
          </div>

          <div className="mt-5 grid gap-3">
            {filteredTasks.map((task) => (
              <div key={task.id} className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="flex flex-wrap gap-2">
                      <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${badgeClass(task.type)}`}>{label(task.type)}</span>
                      <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-semibold text-slate-300">Priority {task.priority}</span>
                      <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-semibold text-slate-300">{label(task.status)}</span>
                      {task.estimatedMinutes ? (
                        <span className="rounded-full border border-amber-300/20 bg-amber-400/10 px-3 py-1 text-xs font-semibold text-amber-100">≈ {task.estimatedMinutes} min</span>
                      ) : null}
                    </div>

                    <h3 className="mt-3 text-lg font-semibold">{task.title}</h3>
                    <p className="mt-1 max-w-4xl text-sm text-slate-400">{task.description}</p>
                    <p className="mt-2 text-xs text-slate-500">
                      {task.vendorName || "Vendor"} · {task.organizationName || "Organization"} · Package: {task.packageTitle || task.packageId}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {task.assignedTo ? `Assigned to ${task.assignedReviewerName || task.assignedTo}` : "Unassigned"}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <WorkflowTaskActions taskId={Number(task.id)} status={task.status} assignedTo={task.assignedTo} />
                    {task.reviewAssignmentId ? (
                      <Link href={`/review-desk/${task.reviewAssignmentId}`} className="rounded-full border border-cyan-300/25 bg-cyan-400/10 px-4 py-2 text-xs font-semibold text-cyan-100 hover:bg-cyan-400/20">
                        Open review
                      </Link>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}

            {filteredTasks.length === 0 ? (
              <p className="rounded-2xl border border-white/10 bg-black/20 p-5 text-sm text-slate-300">
                No workflow tasks match this filter.
              </p>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}
