import GovernanceDashboard from "@/components/governance/governance-dashboard.client";
import prisma from "@/lib/prisma";
import { getCurrentOrgPlanTier, canAccessTier } from "@/lib/billing/plan-access";
import { getGovernanceActor } from "@/lib/auth/truvern-governance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function pretty(value: unknown) {
  return String(value || "Not recorded")
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (match) => match.toUpperCase());
}
export default async function GovernancePage() {
  const actor = await getGovernanceActor().catch(() => null);
  const currentPlanTier = await getCurrentOrgPlanTier().catch(() => "FREE" as const);

  const isTruvernOperator =
    Boolean(
      actor &&
      (
        String((actor as any).role || "").toUpperCase() === "OPS" ||
        String((actor as any).kind || "").toLowerCase() === "ops" ||
        Boolean((actor as any).isTruvernOperator) ||
        Boolean((actor as any).isOperator)
      )
    );

  const canUseGovernance =
    isTruvernOperator ||
    canAccessTier(currentPlanTier, "PRO");

  if (!canUseGovernance) {
    return (
      <main className="min-h-screen bg-slate-950 px-6 py-8 text-white">
        <div className="mx-auto max-w-4xl rounded-3xl border border-amber-300/20 bg-amber-400/10 p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-200">
            Pro governance feature
          </p>

          <h1 className="mt-3 text-3xl font-semibold text-white">
            Governance Office requires Pro or Enterprise
          </h1>

          <p className="mt-3 text-sm leading-7 text-amber-50/90">
            Free users can continue using the current assessment and Truvern Review credit workflow.
            The Governance Operations Dashboard is available for Pro, Enterprise, and Truvern Ops users.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <a
              href="/review-desk"
              className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-semibold text-white hover:bg-white/[0.08]"
            >
              Return to Review Workspace
            </a>

            <a
              href="/plans"
              className="rounded-2xl border border-amber-200/30 bg-amber-300/15 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-300/20"
            >
              View plans
            </a>
          </div>
        </div>
      </main>
    );
  }

  const queueSummary = await prisma.$queryRawUnsafe<any[]>(`
    select
      count(*) filter (where status = 'OPEN')::int as "openWork",
      count(*) filter (where queue = 'VENDOR_WAITING_RESPONSE' and status = 'OPEN')::int as "waitingVendor",
      count(*) filter (where queue = 'EVIDENCE_WAITING_REVIEW' and status = 'OPEN')::int as "waitingAnalyst",
      count(*) filter (where queue in ('READY_FOR_RELEASE_CHECK','GOVERNANCE_RELEASE_READY') and status = 'OPEN')::int as "readyApproval",
      count(*) filter (where "dueAt" is not null and "dueAt" < now() and status = 'OPEN')::int as "critical"
    from "WorkflowQueueItem"
  `);

  const taskSummary = await prisma.$queryRawUnsafe<any[]>(`
    select
      count(*) filter (where status = 'OPEN')::int as "openTasks",
      count(*) filter (where status = 'IN_PROGRESS')::int as "inProgressTasks",
      count(*) filter (where status = 'COMPLETED')::int as "completedTasks"
    from "WorkflowTask"
  `);

  const recentReviews = await prisma.$queryRawUnsafe<any[]>(`
    select
      ra.id,
      v.name as "vendorName",
      ra.status,
      ra."updatedAt"
    from "ReviewAssignment" ra
    left join "Vendor" v on v.id = ra."vendorId"
    order by ra."updatedAt" desc nulls last, ra.id desc
    limit 6
  `);

  const workload = await prisma.$queryRawUnsafe<any[]>(`
    select
      coalesce("assignedReviewerName", "assignedTo", 'Unassigned') as name,
      count(*)::int as active,
      count(*) filter (where "slaDueAt" is not null and "slaDueAt" < now())::int as overdue
    from "WorkflowTask"
    where status in ('OPEN','IN_PROGRESS')
    group by coalesce("assignedReviewerName", "assignedTo", 'Unassigned')
    order by active desc
    limit 6
  `);
  const workflowQueue = await prisma.$queryRawUnsafe<any[]>(`
    select
      id,
      queue,
      status,
      priority,
      "reviewAssignmentId",
      "updatedAt",
      payload
    from "WorkflowQueueItem"
    where status = 'OPEN'
    order by priority desc, "updatedAt" desc
    limit 8
  `);

  const aiQueue = await prisma.$queryRawUnsafe<any[]>(`
    select
      id,
      title,
      status,
      priority,
      "assignedTo",
      "reviewAssignmentId",
      "updatedAt"
    from "WorkflowTask"
    where type = 'AI_PRE_REVIEW'
    order by
      case when status = 'OPEN' then 0 when status = 'IN_PROGRESS' then 1 else 2 end,
      priority desc,
      "updatedAt" desc
    limit 6
  `);

  const releaseReady = await prisma.$queryRawUnsafe<any[]>(`
    select
      qi.id,
      qi.queue,
      qi.status,
      qi.priority,
      qi."reviewAssignmentId",
      qi.payload,
      v.name as "vendorName",
      o.name as "organizationName"
    from "WorkflowQueueItem" qi
    left join "Vendor" v on v.id = qi."vendorId"
    left join "Organization" o on o.id = qi."organizationId"
    where qi.status = 'OPEN'
      and qi.queue in ('READY_FOR_RELEASE_CHECK','GOVERNANCE_RELEASE_READY')
    order by qi.priority desc, qi."updatedAt" desc
    limit 8
  `);

  const recentEvents = await prisma.$queryRawUnsafe<any[]>(`
    select
      id,
      type,
      summary,
      actor,
      "reviewAssignmentId",
      "createdAt"
    from "WorkflowEvent"
    order by "createdAt" desc
    limit 10
  `);

  const q = queueSummary[0] ?? {};
  const t = taskSummary[0] ?? {};

  const kpis = [
    {
      label: "Active Reviews",
      value: q.openWork ?? 0,
      detail: "Open workflow items",
      tone: "cyan",
    },
    {
      label: "Waiting Vendors",
      value: q.waitingVendor ?? 0,
      detail: "Vendor response needed",
      tone: "amber",
    },
    {
      label: "Waiting Analysts",
      value: q.waitingAnalyst ?? 0,
      detail: "Evidence review queue",
      tone: "violet",
    },
    {
      label: "Ready Approval",
      value: q.readyApproval ?? 0,
      detail: "Release or governance gate",
      tone: "emerald",
    },
    {
      label: "Open Tasks",
      value: t.openTasks ?? 0,
      detail: `${t.completedTasks ?? 0} completed`,
      tone: "slate",
    },
  ];

  const quickActions = [
    { label: "Start Review", href: "/governance-ops/start-review", tone: "primary" },
    { label: "Workflow Queue", href: "/review-desk/workflow-queue" },
    { label: "Task Queue", href: "/review-desk/tasks" },
    { label: "Board Packets", href: "/governance-ops" },
    { label: "Command Center", href: "/truvern/ops/command-center" },
  ];

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-8 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-200">
            Pro Governance Office
          </p>

          <h1 className="mt-3 text-3xl font-semibold">
            Governance Operations Dashboard
          </h1>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
            Manage internal vendor reviews, workflow queues, AI-assisted review tasks, release readiness, and governance approvals from one operating dashboard.
          </p>
        </div>

        <GovernanceDashboard
          kpis={kpis}
          workflowHealth={{
            onTrack: Math.max(Number(q.openWork ?? 0) - Number(q.critical ?? 0), 0),
            warnings: 0,
            critical: Number(q.critical ?? 0),
          }}
          quickActions={quickActions}
          recentReviews={recentReviews.map((review) => ({
            id: review.id,
            vendorName: review.vendorName || "Vendor",
            status: review.status || "Not recorded",
            detail: review.updatedAt
              ? `Updated ${new Date(review.updatedAt).toLocaleString()}`
              : "No update recorded",
            href: `/review-desk/${review.id}`,
          }))}
          workload={workload.map((item) => ({
            name: item.name || "Unassigned",
            active: item.active ?? 0,
            overdue: item.overdue ?? 0,
          }))}
        />
        <section className="mt-8 grid gap-6 lg:grid-cols-3">
          <div className="rounded-3xl border border-cyan-300/20 bg-cyan-400/10 p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-100">
              Workflow Queue
            </p>

            <div className="mt-5 space-y-3">
              {workflowQueue.length > 0 ? (
                workflowQueue.map((item) => (
                  <a
                    key={item.id}
                    href={item.reviewAssignmentId ? `/review-desk/${item.reviewAssignmentId}` : "/review-desk/workflow-queue"}
                    className="block rounded-2xl border border-white/10 bg-slate-950/70 p-4 hover:bg-white/[0.04]"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-white">{pretty(item.queue)}</p>
                      <span className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-xs font-semibold text-cyan-100">
                        P{item.priority ?? 0}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-400">
                      {pretty(item.status)} · Assignment #{item.reviewAssignmentId ?? "N/A"}
                    </p>
                  </a>
                ))
              ) : (
                <p className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-slate-300">
                  No open workflow items.
                </p>
              )}
            </div>

            <a
              href="/review-desk/workflow-queue"
              className="mt-5 inline-flex rounded-2xl border border-cyan-300/25 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-100 hover:bg-cyan-400/20"
            >
              Open workflow queue
            </a>
          </div>

          <div className="rounded-3xl border border-indigo-300/20 bg-indigo-400/10 p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-indigo-100">
              AI Review Queue
            </p>

            <div className="mt-5 space-y-3">
              {aiQueue.length > 0 ? (
                aiQueue.map((task) => (
                  <a
                    key={task.id}
                    href={task.reviewAssignmentId ? `/review-desk/${task.reviewAssignmentId}` : "/review-desk/tasks?type=AI_PRE_REVIEW"}
                    className="block rounded-2xl border border-white/10 bg-slate-950/70 p-4 hover:bg-white/[0.04]"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-white">{task.title || "AI Review"}</p>
                      <span className="rounded-full border border-indigo-300/20 bg-indigo-400/10 px-3 py-1 text-xs font-semibold text-indigo-100">
                        {pretty(task.status)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-400">
                      {task.assignedTo || "Unassigned"} · Priority {task.priority ?? 0}
                    </p>
                  </a>
                ))
              ) : (
                <p className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-slate-300">
                  No AI review tasks waiting.
                </p>
              )}
            </div>

            <a
              href="/review-desk/tasks?type=AI_PRE_REVIEW"
              className="mt-5 inline-flex rounded-2xl border border-indigo-300/25 bg-indigo-400/10 px-4 py-2 text-sm font-semibold text-indigo-100 hover:bg-indigo-400/20"
            >
              Open AI tasks
            </a>
          </div>

          <div className="rounded-3xl border border-emerald-300/20 bg-emerald-400/10 p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-100">
              Release Ready
            </p>

            <div className="mt-5 space-y-3">
              {releaseReady.length > 0 ? (
                releaseReady.map((item) => (
                  <a
                    key={item.id}
                    href={item.reviewAssignmentId ? `/review-desk/${item.reviewAssignmentId}` : "/review-desk/workflow-queue?queue=GOVERNANCE_RELEASE_READY"}
                    className="block rounded-2xl border border-white/10 bg-slate-950/70 p-4 hover:bg-white/[0.04]"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-white">{item.vendorName || "Vendor"}</p>
                      <span className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-100">
                        {pretty(item.queue)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-400">
                      {item.organizationName || "Organization"} · Assignment #{item.reviewAssignmentId ?? "N/A"}
                    </p>
                  </a>
                ))
              ) : (
                <p className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-slate-300">
                  No reviews are ready for release.
                </p>
              )}
            </div>

            <a
              href="/review-desk/workflow-queue?queue=GOVERNANCE_RELEASE_READY"
              className="mt-5 inline-flex rounded-2xl border border-emerald-300/25 bg-emerald-400/10 px-4 py-2 text-sm font-semibold text-emerald-100 hover:bg-emerald-400/20"
            >
              Open release queue
            </a>
          </div>
        </section>

        <section className="mt-8 rounded-3xl border border-white/10 bg-white/[0.03] p-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200">
                Recent Governance Activity
              </p>
              <h2 className="mt-3 text-2xl font-semibold text-white">
                Live workflow event stream
              </h2>
            </div>

            <a
              href="/truvern/ops/command-center"
              className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-semibold text-white hover:bg-white/[0.08]"
            >
              Open Command Center
            </a>
          </div>

          <div className="mt-5 grid gap-3">
            {recentEvents.length > 0 ? (
              recentEvents.map((event) => (
                <div
                  key={event.id}
                  className="rounded-2xl border border-white/10 bg-slate-950/70 p-4"
                >
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="font-semibold text-white">{pretty(event.type)}</p>
                      <p className="mt-1 text-sm text-slate-400">
                        {event.summary || "Workflow event recorded."}
                      </p>
                    </div>

                    <div className="text-xs text-slate-500 md:text-right">
                      <p>{event.actor || "System"}</p>
                      <p>{event.createdAt ? new Date(event.createdAt).toLocaleString() : "No timestamp"}</p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-slate-300">
                No workflow events recorded yet.
              </p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}





