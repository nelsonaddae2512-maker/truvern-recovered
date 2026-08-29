import Link from "next/link";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { requireDbOrganization } from "@/lib/org-db";
import {
  readLatestVendorReviewStates,
  readVendorPortfolioPage,
  readVendorPortfolioStageCounts,
  vendorWorkflowStages,
  type VendorWorkflowStage,
} from "@/lib/repositories/vendor-list-review-state-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function riskTone(score: number | null) {
  if (score === null) return "border-white/10 bg-white/5 text-slate-300";
  if (score >= 75) return "border-emerald-400/30 bg-emerald-400/10 text-emerald-200";
  if (score >= 45) return "border-amber-400/30 bg-amber-400/10 text-amber-200";
  return "border-rose-400/30 bg-rose-400/10 text-rose-200";
}

function riskLabel(score: number | null) {
  if (score === null) return "Unscored";
  if (score >= 75) return "Low risk";
  if (score >= 45) return "Medium risk";
  return "High risk";
}

function rowAccent(score: number | null) {
  if (score === null) return "before:bg-slate-500/40";
  if (score >= 75) return "before:bg-emerald-400";
  if (score >= 45) return "before:bg-amber-400";
  return "before:bg-rose-400";
}

function tierLabel(category: string | null) {
  if (!category) return "Unclassified";
  return category;
}

function dataPosture(count: number) {
  if (count >= 5) return "Shared";
  if (count > 0) return "Partial";
  return "Not shared";
}

function reviewPosture(assessments: number, issues: number, evidence = 0, submitted = false) {
  if (issues > 0) return "Needs follow-up";
  if (assessments > 0 && submitted) return "In review";
  if (assessments > 0 && evidence <= 0) return "Awaiting vendor";
  if (assessments > 0) return "In review";
  return "Not started";
}

function progressWidth(value: number) {
  return `${Math.max(0, Math.min(100, value))}%`;
}

function evidenceProgress(evidence: number, requests: number) {
  if (requests <= 0 && evidence <= 0) return 0;
  if (requests <= 0 && evidence > 0) return 100;
  return Math.round((evidence / Math.max(requests, 1)) * 100);
}

function agingStatus(updatedAt: Date) {
  const now = Date.now();
  const updated = new Date(updatedAt).getTime();

  const ageHours = Math.floor((now - updated) / (1000 * 60 * 60));

  if (ageHours >= 72) {
    return {
      label: `${Math.floor(ageHours / 24)}d overdue`,
      tone: "border-rose-400/30 bg-rose-400/10 text-rose-200",
    };
  }

  if (ageHours >= 24) {
    return {
      label: `${Math.floor(ageHours / 24)}d aging`,
      tone: "border-amber-400/30 bg-amber-400/10 text-amber-200",
    };
  }

  return {
    label: "Fresh activity",
    tone: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
  };
}



function reviewProgress(assessments: number, issues: number, evidence = 0, submitted = false) {
  if (issues > 0) return 65;
  if (assessments > 0 && submitted) return 55;
  if (assessments > 0 && evidence <= 0) return 0;
  if (assessments > 0) return 45;
  return 0;
}

function governanceStatus(
  assessments: number,
  issues: number,
  evidence: number,
  submitted = false,
) {
  if (issues > 0) {
    return {
      label: "Remediation open",
      tone: "border-rose-400/30 bg-rose-400/10 text-rose-200",
    };
  }

  if (assessments > 0 && submitted) {
    return {
      label: "Review in progress",
      tone: "border-cyan-400/30 bg-cyan-400/10 text-cyan-200",
    };
  }

  if (assessments > 0 && evidence <= 0) {
    return {
      label: "Awaiting vendor submission",
      tone: "border-amber-400/30 bg-amber-400/10 text-amber-200",
    };
  }

  if (assessments > 0 && evidence > 0) {
    return {
      label: "In Truvern review",
      tone: "border-cyan-400/30 bg-cyan-400/10 text-cyan-200",
    };
  }

  return {
    label: "Awaiting intake",
    tone: "border-slate-400/30 bg-slate-400/10 text-slate-200",
  };
}

type VendorsPageSearchParams = {
  q?: string | string[];
  stage?: string | string[];
  page?: string | string[];
};

function firstSearchValue(
  value: string | string[] | undefined,
) {
  return Array.isArray(value)
    ? value[0] ?? ""
    : value ?? "";
}

function parseVendorStage(
  value: string,
): VendorWorkflowStage | null {
  return vendorWorkflowStages.includes(
    value as VendorWorkflowStage,
  )
    ? (value as VendorWorkflowStage)
    : null;
}

function vendorListHref(input: {
  q?: string;
  stage?: VendorWorkflowStage | null;
  page?: number;
}) {
  const params =
    new URLSearchParams();

  const q =
    String(input.q ?? "")
      .trim();

  if (q) {
    params.set(
      "q",
      q,
    );
  }

  if (input.stage) {
    params.set(
      "stage",
      input.stage,
    );
  }

  if (
    input.page &&
    input.page > 1
  ) {
    params.set(
      "page",
      String(input.page),
    );
  }

  const query =
    params.toString();

  return query
    ? `/vendors?${query}`
    : "/vendors";
}

export default async function VendorsPage({
  searchParams,
}: {
  searchParams?: Promise<VendorsPageSearchParams>;
}) {
  const org = await requireDbOrganization();

  let organizationId: number;

  if ("_needsOrgSelection" in org) {
    redirect("/dashboard");
  } else {
    organizationId = org.id;
  }

  const resolvedSearchParams =
    (await searchParams) ?? {};

  const q =
    firstSearchValue(
      resolvedSearchParams.q,
    )
      .trim()
      .slice(0, 200);

  const selectedStage =
    parseVendorStage(
      firstSearchValue(
        resolvedSearchParams.stage,
      ),
    );

  const requestedPage =
    Number.parseInt(
      firstSearchValue(
        resolvedSearchParams.page,
      ),
      10,
    );

  const pageNumber =
    Number.isFinite(
      requestedPage,
    ) &&
    requestedPage > 0
      ? requestedPage
      : 1;

  const pageSize = 50;

  const [
    portfolio,
    stageCounts,
  ] =
    await Promise.all([
      readVendorPortfolioPage({
        organizationId,
        q,
        stage: selectedStage,
        page: pageNumber,
        pageSize,
      }),

      readVendorPortfolioStageCounts(
        organizationId,
      ),
    ]);

  const totalPages =
    Math.max(
      1,
      Math.ceil(
        portfolio.total /
          pageSize,
      ),
    );

  if (
    portfolio.total > 0 &&
    pageNumber > totalPages
  ) {
    redirect(
      vendorListHref({
        q,
        stage: selectedStage,
        page: totalPages,
      }),
    );
  }

  const vendorIds =
    portfolio.rows.map(
      (row) =>
        row.vendorId,
    );

  const vendors =
    vendorIds.length > 0
      ? await prisma.vendor.findMany({
          where: {
            organizationId,
            id: {
              in: vendorIds,
            },
          },

          select: {
            id: true,
            name: true,
            slug: true,
            category: true,
            riskScore: true,
            updatedAt: true,
            tier: true,
            criticality: true,
            lastAssessmentCompletedAt: true,
            nextReviewDueAt: true,
            reviewCadenceDays: true,

            assessments: {
              where: {
                status: {
                  notIn: [
                    "ARCHIVED",
                    "RELEASED",
                    "COMPLETED",
                  ],
                },
              },

              orderBy: [
                {
                  updatedAt: "desc",
                },
                {
                  id: "desc",
                },
              ],

              take: 1,

              select: {
                id: true,
                status: true,
                isVendorSubmitted: true,
                submittedAt: true,
              },
            },

            _count: {
              select: {
                evidence: true,

                assessments: {
                  where: {
                    status: {
                      notIn: [
                        "ARCHIVED",
                        "RELEASED",
                        "COMPLETED",
                      ],
                    },
                  },
                },

                issues: true,
                evidenceRequests: true,
              },
            },
          },
        })
      : [];

  const vendorById =
    new Map(
      vendors.map(
        (vendor) => [
          vendor.id,
          vendor,
        ] as const,
      ),
    );

  const orderedVendors =
    vendorIds.flatMap(
      (vendorId) => {
        const vendor =
          vendorById.get(
            vendorId,
          );

        return vendor
          ? [vendor]
          : [];
      },
    );

  const reviewStateRows =
    await readLatestVendorReviewStates(
      organizationId,
      vendorIds,
    );

  const reviewStateByVendorId = new Map(
    reviewStateRows.map((row) => [Number(row.vendorId), row]),
  );

  const totalVendors =
    vendorWorkflowStages.reduce(
      (sum, stage) =>
        sum +
        stageCounts[stage],
      0,
    );

  const firstResult =
    portfolio.total === 0
      ? 0
      : (
          (pageNumber - 1) *
            pageSize
        ) + 1;

  const lastResult =
    Math.min(
      portfolio.total,
      pageNumber * pageSize,
    );

  return (
    <main className="mx-auto max-w-7xl px-6 py-12 text-white">
            <section className="mb-8 rounded-[2rem] border border-cyan-400/20 bg-cyan-500/10 p-6 shadow-2xl shadow-cyan-500/10">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-200">
              Truvern Reviews
            </div>

            <h2 className="mt-3 text-2xl font-black tracking-tight text-white">
              Need help reviewing vendors? Send them to Truvern.
            </h2>

            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
              Truvern Ops can send the questionnaire, collect evidence, review
              responses, generate findings, manage remediation, and deliver a
              clean governance report for 1 Truvern credit.
            </p>
          </div>

          <a
            href="/managed-assessments"
            className="inline-flex shrink-0 items-center justify-center rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
          >
            Learn about Truvern Reviews
          </a>
        </div>
      </section>
<section className="flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
        <div>
          <div className="inline-flex rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm text-cyan-200">
            Vendor reviews
          </div>

          <h1 className="mt-6 text-5xl font-semibold tracking-tight">
            Vendor review workspace.
          </h1>

          <p className="mt-4 max-w-3xl text-base leading-8 text-slate-300">
            Track vendor tier, evidence coverage, assessment activity, review
            posture, open issues, and data-sharing readiness from one workspace.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/vendors/new"
            className="rounded-full bg-cyan-300 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
          >
            Add vendor
          </Link>

          <Link
            href="/review-desk"
            className="rounded-full border border-white/15 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            Governance Ops
          </Link>

          <Link
            href="/dashboard"
            className="rounded-full border border-white/15 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            Dashboard
          </Link>
        </div>
      </section>

      <section className="mt-10">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-200">
              Governance portfolio
            </p>

            <h2 className="mt-2 text-2xl font-semibold text-white">
              Vendor lifecycle at a glance
            </h2>
          </div>

          <Link
            href={vendorListHref({
              q,
            })}
            className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${
              selectedStage === null
                ? "border-cyan-300/40 bg-cyan-300/10 text-cyan-100"
                : "border-white/10 text-slate-300 hover:bg-white/5"
            }`}
          >
            All vendors Â· {totalVendors}
          </Link>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {vendorWorkflowStages.map(
            (stage) => (
              <Link
                key={stage}
                href={vendorListHref({
                  q,
                  stage,
                })}
                className="block"
              >
                <SummaryCard
                  label={stage}
                  value={
                    stageCounts[
                      stage
                    ].toString()
                  }
                  active={
                    selectedStage ===
                    stage
                  }
                />
              </Link>
            ),
          )}
        </div>
      </section>

      <section className="mt-8 rounded-[2rem] border border-white/10 bg-white/[0.035] p-5">
        <form
          action="/vendors"
          method="get"
          className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_auto_auto] lg:items-end"
        >
          <label>
            <span className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
              Search vendors
            </span>

            <input
              name="q"
              type="search"
              defaultValue={q}
              placeholder="Search vendor, contact, email, or website"
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/50"
            />
          </label>

          <label>
            <span className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
              Governance stage
            </span>

            <select
              name="stage"
              defaultValue={
                selectedStage ?? ""
              }
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/50"
            >
              <option value="">
                All stages
              </option>

              {vendorWorkflowStages.map(
                (stage) => (
                  <option
                    key={stage}
                    value={stage}
                  >
                    {stage}
                  </option>
                ),
              )}
            </select>
          </label>

          <button
            type="submit"
            className="rounded-2xl bg-cyan-300 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
          >
            Search
          </button>

          <Link
            href="/vendors"
            className="inline-flex items-center justify-center rounded-2xl border border-white/15 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            Clear
          </Link>
        </form>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-400">
          <span>
            Showing{" "}
            <strong className="font-semibold text-white">
              {firstResult}-{lastResult}
            </strong>{" "}
            of{" "}
            <strong className="font-semibold text-white">
              {portfolio.total}
            </strong>{" "}
            matching vendors
          </span>

          {q ? (
            <span>
              Search: â€œ{q}â€
            </span>
          ) : null}
        </div>
      </section>

      <section className="mt-6 rounded-[2rem] border border-cyan-400/20 bg-white/[0.05] shadow-2xl shadow-cyan-950/30">
        <div className="flex flex-col gap-4 border-b border-white/10 p-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
              Registry
            </p>

            <h2 className="mt-2 text-2xl font-semibold">
              Vendor review table
            </h2>
          </div>

          <div className="flex flex-wrap gap-2 text-xs text-slate-300">
            <span className="rounded-full border border-white/10 bg-slate-950/40 px-3 py-1">
              Tier
            </span>
            <span className="rounded-full border border-white/10 bg-slate-950/40 px-3 py-1">
              Data shared
            </span>
            <span className="rounded-full border border-white/10 bg-slate-950/40 px-3 py-1">
              Review posture
            </span>
            <span className="rounded-full border border-white/10 bg-slate-950/40 px-3 py-1">
              Issues
            </span>
          </div>
        </div>

        {orderedVendors.length === 0 ? (
          <div className="p-8">
            <h2 className="text-xl font-semibold text-white">
              {q || selectedStage
                ? "No vendors match this search"
                : "No vendors yet"}
            </h2>
            <p className="mt-2 text-slate-300">
              {q || selectedStage
                ? "Try another search or clear the current filters."
                : "Add your first vendor to request a Truvern Review, track evidence, findings, remediation, and release-ready governance outputs."}
            </p>

            <Link
              href="/vendors/new"
              className="mt-6 inline-flex rounded-full bg-cyan-300 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
            >
              Add vendor
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-cyan-400/15">
            {orderedVendors.map((vendor) => {
              const score = typeof vendor.riskScore === "number" ? vendor.riskScore : null;
              const evidenceCount = vendor._count.evidence;
              const assessmentsCount = vendor.assessments.length;
              const issuesCount = vendor._count.issues;
              const requestsCount = vendor._count.evidenceRequests;
              const latestAssessment = vendor.assessments[0] ?? null;              const latestReviewState = reviewStateByVendorId.get(vendor.id);

              const releaseState = String(
                latestReviewState?.releaseState ?? ""
              ).toUpperCase();

              const reviewIntent = String(
                latestReviewState?.intent ?? ""
              ).toUpperCase();

              const reviewAssignmentStatus = String(
                latestReviewState?.assignmentStatus ?? ""
              ).toUpperCase();
              const vendorSubmitted = Boolean(
                latestAssessment?.isVendorSubmitted ||
                  latestAssessment?.submittedAt ||
                  String(latestAssessment?.status ?? "").toUpperCase().includes("SUBMITTED"),
              );

              const reviewReleased =
                releaseState === "RELEASED" ||
                releaseState === "CONFIRMED";

              const reviewReady =
                releaseState === "COMPLETED" ||
                releaseState === "READY_FOR_RELEASE" ||
                reviewAssignmentStatus === "COMPLETED";

              const reviewActive =
                reviewAssignmentStatus === "IN_PROGRESS" ||
                reviewAssignmentStatus === "CLAIMED" ||
                reviewAssignmentStatus === "SUBMITTED";

              let governance;

              if (reviewReleased) {
                governance = {
                  label: "Governance released",
                  tone: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
                };
              } else if (reviewReady) {
                governance = {
                  label: "Release ready",
                  tone: "border-cyan-400/30 bg-cyan-400/10 text-cyan-200",
                };
              } else if (reviewActive) {
                governance = {
                  label: "Review in progress",
                  tone: "border-cyan-400/30 bg-cyan-400/10 text-cyan-200",
                };
              } else {
                governance = governanceStatus(
                  assessmentsCount,
                  issuesCount,
                  evidenceCount,
                  vendorSubmitted,
                );
              };

              const evidencePct = reviewReleased
                ? 100
                : reviewReady
                ? Math.max(75, evidenceProgress(evidenceCount, requestsCount))
                : reviewActive
                ? Math.max(50, evidenceProgress(evidenceCount, requestsCount))
                : evidenceProgress(evidenceCount, requestsCount);
              const reviewPct = reviewReleased
                ? 100
                : reviewReady
                ? 85
                : reviewActive
                ? 65
                : reviewProgress(assessmentsCount, issuesCount, evidenceCount, vendorSubmitted);

              const aging = agingStatus(vendor.updatedAt);
              const activeStage =
                portfolio.rows.find(
                  (row) =>
                    row.vendorId ===
                    vendor.id,
                )?.stage ?? "Intake";

              return (
                <div
                  key={vendor.id}
                  className={`relative mx-4 my-3 grid gap-6 rounded-[1.75rem] border border-white/10 bg-slate-950/20 p-6 transition before:absolute before:inset-y-5 before:left-0 before:w-1 before:rounded-r-full hover:border-cyan-300/20 hover:bg-cyan-400/[0.035] xl:grid-cols-[1.05fr_1.45fr_1.55fr_300px] xl:items-center ${rowAccent(score)}`}
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="text-xl font-semibold text-white">
                        {vendor.name}
                      </h3>

                      <span className={`rounded-full border px-3 py-1 text-xs ${riskTone(score)}`}>
                        {riskLabel(score)}
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-400">

                      <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${governance.tone}`}>
                        {governance.label}
                      </span>

                      {!reviewReleased && !reviewReady ? (
                        <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${aging.tone}`}>
                          {aging.label}
                        </span>
                      ) : null}
                      <span>#{vendor.id}</span>
                      <span>â€¢ Tier: {tierLabel(vendor.tier ?? vendor.category)}</span>
                      <span>â€¢ Updated {vendor.updatedAt.toLocaleDateString()}</span>
                      {vendor.nextReviewDueAt ? (
                        <span className="text-cyan-200">
                          â€¢ Reassessment due{" "}
                          {vendor.nextReviewDueAt.toLocaleDateString()}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="space-y-4 border-l border-white/10 px-7">
                    <WorkflowRail activeStage={activeStage} />
                    <ProgressBar label="Evidence" value={evidencePct} />
                    <ProgressBar label="Review" value={reviewPct} />
                  </div>

                  <div className="grid min-w-0 grid-cols-[1.15fr_1.15fr_1fr_.7fr] border-l border-white/10">
                    <Metric
                      label="Tier"
                      value={tierLabel(vendor.tier ?? vendor.category)}
                    />
                    <Metric
                      label="Data shared"
                      value={dataPosture(evidenceCount)}
                    />
                    <Metric
                      label="Review requests"
                      value={requestsCount.toString()}
                    />
                    <Metric
                      label="Issues"
                      value={issuesCount.toString()}
                    />
                  </div>

                  <div className="flex w-full max-w-[300px] flex-col gap-3 border-l border-white/10 pl-7 xl:items-stretch">
                    <div className="flex flex-wrap gap-3">
                      <Link
                        href={`/vendors/${vendor.id}`}
                        className="inline-flex w-full items-center justify-center gap-3 rounded-2xl bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
                      >
                        Open vendor workspace
                      </Link>

                      <Link
                        href={`/vendors/${vendor.id}/managed-review`}
                        className="inline-flex w-full items-center justify-center gap-3 rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
                      >
                        Request Truvern Review
                      </Link>
                    </div>

                    <Link
                      href={`/vendors/${vendor.id}#reviews`}
                      className="inline-flex items-center justify-center gap-3 rounded-full border border-white/15 px-5 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
                    >
                      Review history
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {totalPages > 1 ? (
          <div className="flex flex-col gap-3 border-t border-white/10 p-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-400">
              Page{" "}
              <span className="font-semibold text-white">
                {pageNumber}
              </span>{" "}
              of{" "}
              <span className="font-semibold text-white">
                {totalPages}
              </span>
            </p>

            <div className="flex gap-2">
              {pageNumber > 1 ? (
                <Link
                  href={vendorListHref({
                    q,
                    stage:
                      selectedStage,
                    page:
                      pageNumber - 1,
                  })}
                  className="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  Previous
                </Link>
              ) : (
                <span className="rounded-full border border-white/5 px-4 py-2 text-sm text-slate-600">
                  Previous
                </span>
              )}

              {pageNumber <
              totalPages ? (
                <Link
                  href={vendorListHref({
                    q,
                    stage:
                      selectedStage,
                    page:
                      pageNumber + 1,
                  })}
                  className="rounded-full bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
                >
                  Next
                </Link>
              ) : (
                <span className="rounded-full border border-white/5 px-4 py-2 text-sm text-slate-600">
                  Next
                </span>
              )}
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}

function SummaryCard({
  label,
  value,
  active = false,
}: {
  label: string;
  value: string;
  active?: boolean;
}) {
  return (
    <div
      className={`rounded-3xl border p-5 transition ${
        active
          ? "border-cyan-300/40 bg-cyan-300/10 shadow-lg shadow-cyan-950/20"
          : "border-white/10 bg-white/[0.04] hover:border-cyan-300/20 hover:bg-white/[0.06]"
      }`}
    >
      <p className="text-xs uppercase tracking-[0.25em] text-slate-400">
        {label}
      </p>
      <p className="mt-3 text-3xl font-semibold text-white">{value}</p>
    </div>
  );
}

function WorkflowRail({ activeStage }: { activeStage: string }) {
  return (
    <div className="w-full max-w-sm">
      <div className="flex items-center justify-between gap-1">
        {vendorWorkflowStages.map((stage) => {
          const active = stage === activeStage;

          return (
            <div key={stage} className="flex flex-1 flex-col items-center gap-1">
              <div
                className={`h-1.5 w-full rounded-full ${
                  active
                    ? "bg-cyan-300 shadow-[0_0_14px_rgba(103,232,249,0.55)]"
                    : "bg-slate-800 ring-1 ring-white/10"
                }`}
              />
              <span
                className={`text-[8px] uppercase tracking-[0.14em] ${
                  active ? "text-cyan-100" : "text-slate-600"
                }`}
              >
                {stage}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ProgressBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="w-full max-w-sm">
      <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.18em] text-slate-500">
        <span>{label}</span>
        <span>{value}%</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-950/70 ring-1 ring-white/10">
        <div
          className="h-full rounded-full bg-cyan-300 shadow-[0_0_16px_rgba(103,232,249,0.45)]"
          style={{ width: progressWidth(value) }}
        />
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-h-[108px] min-w-0 flex-col items-center justify-center border-r border-white/10 px-2 text-center last:border-r-0 2xl:px-3">
      <p className="max-w-full whitespace-normal text-[9px] font-semibold uppercase leading-4 tracking-[0.12em] text-slate-500 2xl:text-[10px]">
        {label}
      </p>
      <p
        className="mt-3 max-w-full whitespace-normal text-sm font-bold leading-snug text-white 2xl:text-base"
        style={{ overflowWrap: "normal", wordBreak: "normal" }}
      >
        {value}
      </p>
    </div>
  );
}
