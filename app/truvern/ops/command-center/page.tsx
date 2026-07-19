import Link from "next/link";
import prisma from "@/lib/prisma";
import RunWorkflowSchedulerButton from "@/components/truvern/ops/run-workflow-scheduler-button.client";
import RunWorkflowOrchestratorButton from "@/components/truvern/ops/run-workflow-orchestrator-button.client";
import RunAiReviewWorkerButton from "@/components/truvern/ops/run-ai-review-worker-button.client";
import RunReleaseReadinessButton from "@/components/truvern/ops/run-release-readiness-button.client";
import RunTruvernWorkflowButton from "@/components/truvern/ops/run-truvern-workflow-button.client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function formatQueue(value: string) {
  return String(value || "QUEUE")
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function queueClass(queue: string) {
  if (queue === "EVIDENCE_WAITING_REVIEW") return "border-cyan-300/25 bg-cyan-400/10 text-cyan-100";
  if (queue === "VENDOR_WAITING_RESPONSE") return "border-amber-300/25 bg-amber-400/10 text-amber-100";
  if (queue === "READY_FOR_RELEASE_CHECK") return "border-emerald-300/25 bg-emerald-400/10 text-emerald-100";
  if (queue === "GOVERNANCE_RELEASE_READY") return "border-lime-300/25 bg-lime-400/10 text-lime-100";
  if (queue === "UNDER_TRUVERN_REVIEW") return "border-violet-300/25 bg-violet-400/10 text-violet-100";
  return "border-white/10 bg-white/[0.04] text-slate-200";
}

export default async function TruvernOpsCommandCenterPage() {
  const queueSummary = await prisma.$queryRawUnsafe<any[]>(`
    select
      queue,
      status,
      count(*)::int as count,
      max("updatedAt") as "lastUpdatedAt"
    from "WorkflowQueueItem"
    group by queue, status
    order by count desc, queue asc
  `);

  const totals = await prisma.$queryRawUnsafe<any[]>(`
    select
      count(*)::int as "totalQueueItems",
      count(*) filter (where status = 'OPEN')::int as "openQueueItems",
      count(*) filter (where "assignedTo" is not null and status = 'OPEN')::int as "claimedOpenItems",
      count(*) filter (where "assignedTo" is null and status = 'OPEN')::int as "unclaimedOpenItems",
      count(*) filter (where "dueAt" is not null and "dueAt" < now() and status = 'OPEN')::int as "slaBreaches"
    from "WorkflowQueueItem"
  `);

  const taskMetrics = await prisma.$queryRawUnsafe<any[]>(`
    select
      count(*)::int as "totalTasks",
      count(*) filter (where status = 'OPEN')::int as "openTasks",
      count(*) filter (where status = 'IN_PROGRESS')::int as "inProgressTasks",
      count(*) filter (where status = 'COMPLETED')::int as "completedTasks",
      round(
        case
          when count(*) = 0 then 0
          else (count(*) filter (where status = 'COMPLETED')::numeric / count(*)::numeric) * 100
        end,
        1
      ) as "completionRate"
    from "WorkflowTask"
  `);

  const packageMetrics = await prisma.$queryRawUnsafe<any[]>(`
    select
      count(*)::int as "totalPackages",
      count(*) filter (where status = 'APPROVED')::int as "approvedPackages",
      count(*) filter (where status = 'COMPLETED')::int as "completedPackages",
      count(*) filter (where status in ('SUBMITTED','IN_REVIEW','NEEDS_MORE','REQUESTED'))::int as "activePackages"
    from "RemediationPackage"
  `);
  const reviewerLoad = await prisma.$queryRawUnsafe<any[]>(`
    select
      coalesce(payload->>'assignedReviewerName', "assignedTo", 'Unassigned') as reviewer,
      count(*)::int as count,
      count(*) filter (where queue = 'EVIDENCE_WAITING_REVIEW')::int as "evidenceReview",
      count(*) filter (where queue = 'READY_FOR_RELEASE_CHECK')::int as "releaseCheck",
      count(*) filter (where "dueAt" is not null and "dueAt" < now())::int as "overdue"
    from "WorkflowQueueItem"
    where status = 'OPEN'
    group by coalesce(payload->>'assignedReviewerName', "assignedTo", 'Unassigned')
    order by count desc
  `);

  const aiMetrics = await prisma.$queryRawUnsafe<any[]>(`
    select
      count(*) filter (where type = 'AI_PRE_REVIEW')::int as "aiTasks",
      count(*) filter (where type = 'AI_PRE_REVIEW' and status = 'COMPLETED')::int as "completedAiTasks",
      count(*) filter (where "assignedTo" = 'AI_WORKER')::int as "aiOwned"
    from "WorkflowTask"
  `);
  const governanceReleaseMetrics = await prisma.$queryRawUnsafe<any[]>(`
    select
      count(*) filter (
        where queue = 'GOVERNANCE_RELEASE_READY'
          and status = 'OPEN'
      )::int as "governanceReleaseReady",
      max("updatedAt") filter (
        where queue = 'GOVERNANCE_RELEASE_READY'
      ) as "lastGovernanceGateAt"
    from "WorkflowQueueItem"
  `);
  const releaseReadinessMetrics = await prisma.$queryRawUnsafe<any[]>(`
    select
      count(*) filter (
        where qi.payload->'releaseReadiness'->>'state' = 'READY_FOR_RELEASE'
      )::int as "readyForRelease",
      count(*) filter (
        where qi.payload->'releaseReadiness'->>'state' = 'RELEASE_BLOCKED'
      )::int as "releaseBlocked",
      max(qi."updatedAt") filter (
        where qi.payload ? 'releaseReadiness'
      ) as "lastReadinessCheckAt"
    from "WorkflowQueueItem" qi
  `);
  const pipelineMetrics = await prisma.$queryRawUnsafe<any[]>(`
    select
      count(*) filter (where type = 'WORKFLOW_TASKS_GENERATED')::int as "taskGenerationEvents",
      count(*) filter (where type = 'AI_PRE_REVIEW_COMPLETED')::int as "aiCompletedEvents",
      count(*) filter (where type = 'WORKFLOW_ESCALATED')::int as "escalationEvents",
      max("createdAt") filter (
        where type in ('WORKFLOW_TASKS_GENERATED','AI_PRE_REVIEW_COMPLETED','WORKFLOW_ESCALATED','QUEUE_ITEM_CLAIMED')
      ) as "lastPipelineEventAt"
    from "WorkflowEvent"
  `);
  const recentEvents = await prisma.$queryRawUnsafe<any[]>(`
    select
      we.type,
      we.summary,
      we.actor,
      we."createdAt",
      v.name as "vendorName",
      o.name as "organizationName"
    from "WorkflowEvent" we
    left join "Vendor" v on v.id = we."vendorId"
    left join "Organization" o on o.id = we."organizationId"
    order by we."createdAt" desc
    limit 20
  `);

  const t = totals[0] ?? {};
  const tm = {
    ...(taskMetrics[0] ?? {}),
    completionRate: Number(taskMetrics?.[0]?.completionRate ?? 0),
  };
  const pm = packageMetrics[0] ?? {};
  const ai = aiMetrics[0] ?? {};
  const pipe = pipelineMetrics[0] ?? {};
  const rr = releaseReadinessMetrics[0] ?? {};
  const gr = governanceReleaseMetrics[0] ?? {};

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-8 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-200">
              Truvern Operations Command Center
            </p>
            <h1 className="mt-3 text-3xl font-semibold">
              Workflow control tower
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
              Live queue health, reviewer workload, SLA pressure, and workflow events across Truvern managed reviews.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <RunTruvernWorkflowButton />
            <RunWorkflowSchedulerButton />
            <RunWorkflowOrchestratorButton />
            <RunAiReviewWorkerButton />
            <RunReleaseReadinessButton />

            <Link
              href="/review-desk/workflow-queue"
              className="rounded-2xl border border-cyan-300/25 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-100 hover:bg-cyan-400/20"
            >
              Open workflow queue
            </Link>
          </div>
        </div>

        <section className="mt-8 grid gap-4 md:grid-cols-5">
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Open work</p>
            <p className="mt-3 text-3xl font-semibold">{t.openQueueItems ?? 0}</p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Claimed</p>
            <p className="mt-3 text-3xl font-semibold">{t.claimedOpenItems ?? 0}</p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Unclaimed</p>
            <p className="mt-3 text-3xl font-semibold">{t.unclaimedOpenItems ?? 0}</p>
          </div>

          <div className="rounded-3xl border border-rose-300/20 bg-rose-400/10 p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-rose-100">SLA breaches</p>
            <p className="mt-3 text-3xl font-semibold">{t.slaBreaches ?? 0}</p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Total queue</p>
            <p className="mt-3 text-3xl font-semibold">{t.totalQueueItems ?? 0}</p>
          </div>
        </section>

        <section className="mt-8 grid gap-4 md:grid-cols-5">
          <div className="rounded-3xl border border-cyan-300/20 bg-cyan-400/10 p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-cyan-100">Open tasks</p>
            <p className="mt-3 text-3xl font-semibold">{tm.openTasks ?? 0}</p>
          </div>

          <div className="rounded-3xl border border-violet-300/20 bg-violet-400/10 p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-violet-100">In progress</p>
            <p className="mt-3 text-3xl font-semibold">{tm.inProgressTasks ?? 0}</p>
          </div>

          <div className="rounded-3xl border border-emerald-300/20 bg-emerald-400/10 p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-emerald-100">Completed tasks</p>
            <p className="mt-3 text-3xl font-semibold">{tm.completedTasks ?? 0}</p>
          </div>

          <div className="rounded-3xl border border-amber-300/20 bg-amber-400/10 p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-amber-100">Task completion</p>
            <p className="mt-3 text-3xl font-semibold">{tm.completionRate ?? 0}%</p>
          </div>

          <div className="rounded-3xl border border-emerald-300/20 bg-emerald-400/10 p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-emerald-100">Ready packages</p>
            <p className="mt-3 text-3xl font-semibold">{pm.approvedPackages ?? 0}</p>
          </div>
        </section>
        <section className="mt-8 grid gap-4 md:grid-cols-2">
          <div className="rounded-3xl border border-lime-300/20 bg-lime-500/10 p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-lime-100">
              Governance release ready
            </p>
            <p className="mt-3 text-3xl font-semibold">
              {gr.governanceReleaseReady ?? 0}
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
              Last governance gate
            </p>
            <p className="mt-3 text-sm font-semibold text-white">
              {gr.lastGovernanceGateAt ? new Date(gr.lastGovernanceGateAt).toLocaleString() : "Not recorded"}
            </p>
          </div>
        </section>
        <section className="mt-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl border border-indigo-300/20 bg-indigo-500/10 p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-indigo-100">
              AI Tasks
            </p>
            <p className="mt-3 text-3xl font-semibold">
              {ai.aiTasks ?? 0}
            </p>
          </div>

          <div className="rounded-3xl border border-emerald-300/20 bg-emerald-500/10 p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-emerald-100">
              AI Completed
            </p>
            <p className="mt-3 text-3xl font-semibold">
              {ai.completedAiTasks ?? 0}
            </p>
          </div>

          <div className="rounded-3xl border border-cyan-300/20 bg-cyan-500/10 p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-cyan-100">
              AI Worker Ownership
            </p>
            <p className="mt-3 text-3xl font-semibold">
              {ai.aiOwned ?? 0}
            </p>
          </div>
        </section>
        <section className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
            <h2 className="text-xl font-semibold">Queue health</h2>

            <div className="mt-5 grid gap-3">
              {queueSummary.map((row) => (
                <div key={`${row.queue}-${row.status}`} className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${queueClass(row.queue)}`}>
                        {formatQueue(row.queue)}
                      </span>
                      <p className="mt-2 text-sm text-slate-400">{row.status}</p>
                    </div>
                    <p className="text-3xl font-semibold">{row.count}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
            <h2 className="text-xl font-semibold">Reviewer workload</h2>

            <div className="mt-5 grid gap-3">
              {reviewerLoad.map((row) => (
                <div key={row.reviewer} className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold">{row.reviewer}</p>
                      <p className="mt-1 text-xs text-slate-400">
                        Evidence {row.evidenceReview} · Release {row.releaseCheck} · Overdue {row.overdue}
                      </p>
                    </div>
                    <p className="text-2xl font-semibold">{row.count}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-8 grid gap-4 md:grid-cols-2">
          <div className="rounded-3xl border border-lime-300/20 bg-lime-500/10 p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-lime-100">
              Governance release ready
            </p>
            <p className="mt-3 text-3xl font-semibold">
              {gr.governanceReleaseReady ?? 0}
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
              Last governance gate
            </p>
            <p className="mt-3 text-sm font-semibold text-white">
              {gr.lastGovernanceGateAt ? new Date(gr.lastGovernanceGateAt).toLocaleString() : "Not recorded"}
            </p>
          </div>
        </section>
        <section className="mt-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl border border-emerald-300/20 bg-emerald-500/10 p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-emerald-100">
              Release ready
            </p>
            <p className="mt-3 text-3xl font-semibold">
              {rr.readyForRelease ?? 0}
            </p>
          </div>

          <div className="rounded-3xl border border-rose-300/20 bg-rose-500/10 p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-rose-100">
              Release blocked
            </p>
            <p className="mt-3 text-3xl font-semibold">
              {rr.releaseBlocked ?? 0}
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
              Last readiness check
            </p>
            <p className="mt-3 text-sm font-semibold text-white">
              {rr.lastReadinessCheckAt ? new Date(rr.lastReadinessCheckAt).toLocaleString() : "Not recorded"}
            </p>
          </div>
        </section>
        <section className="mt-8 grid gap-4 md:grid-cols-4">
          <div className="rounded-3xl border border-cyan-300/20 bg-cyan-500/10 p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-cyan-100">
              Task generation runs
            </p>
            <p className="mt-3 text-3xl font-semibold">
              {pipe.taskGenerationEvents ?? 0}
            </p>
          </div>

          <div className="rounded-3xl border border-indigo-300/20 bg-indigo-500/10 p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-indigo-100">
              AI completions
            </p>
            <p className="mt-3 text-3xl font-semibold">
              {pipe.aiCompletedEvents ?? 0}
            </p>
          </div>

          <div className="rounded-3xl border border-rose-300/20 bg-rose-500/10 p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-rose-100">
              Escalations
            </p>
            <p className="mt-3 text-3xl font-semibold">
              {pipe.escalationEvents ?? 0}
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
              Last pipeline event
            </p>
            <p className="mt-3 text-sm font-semibold text-white">
              {pipe.lastPipelineEventAt ? new Date(pipe.lastPipelineEventAt).toLocaleString() : "Not recorded"}
            </p>
          </div>
        </section>
        <section className="mt-8 rounded-3xl border border-white/10 bg-white/[0.03] p-5">
          <h2 className="text-xl font-semibold">Recent workflow events</h2>

          <div className="mt-5 grid gap-3">
            {recentEvents.map((event, index) => (
              <div key={`${event.type}-${event.createdAt}-${index}`} className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-sm font-semibold">{event.summary}</p>
                    <p className="mt-1 text-xs text-slate-400">
                      {event.type} · {event.vendorName || "Vendor"} · {event.organizationName || "Organization"}
                    </p>
                  </div>
                  <p className="text-xs text-slate-500">
                    {event.createdAt ? new Date(event.createdAt).toLocaleString() : "Not recorded"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}










