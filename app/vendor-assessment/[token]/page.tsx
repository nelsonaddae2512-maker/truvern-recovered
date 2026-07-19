import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import VendorAssessmentRunClient from "@/components/vendor-assessment-run-client";
import VendorAssessmentAutoRefresh from "@/components/vendor-assessment-auto-refresh.client";
import VendorEvidenceRequestSubmitClient from "@/components/vendor-portal/vendor-evidence-request-submit.client";
import VendorRemediationCard from "@/components/vendor-portal/vendor-remediation-card";
import VendorRemediationProgress from "@/components/vendor-portal/vendor-remediation-progress";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = {
  params: Promise<{ token: string }> | { token: string };
};

function parseOptions(value: any): string[] {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value.map(String);
  }

  if (
    typeof value === "object" &&
    Array.isArray(value.options)
  ) {
    return value.options.map(String);
  }

  return [];
}


export default async function VendorAssessmentPortalPage({
  params,
}: Props) {
  const resolvedParams = await params;
  const token = String(resolvedParams.token || "").trim();

  if (!token) {
    return notFound();
  }

  const assessment = await prisma.assessment.findFirst({
    where: {
      token,
    },

    include: {
      vendor: {
        select: {
          id: true,
          name: true,
        },
      },

      answers: true,

      template: {
        include: {
          sections: {
            orderBy: [
              { order: "asc" },
              { id: "asc" },
            ],

            include: {
              questions: {
                orderBy: [
                  { orderIndex: "asc" },
                  { id: "asc" },
                ],
              },
            },
          },
        },
      },
    },
  });

  if (!assessment) {
    return notFound();
  }

  if (!assessment.vendor?.id) {
    return notFound();
  }

  if (!assessment.openedAt) {
    await prisma.assessment.update({
      where: {
        id: assessment.id,
      },

      data: {
        openedAt: new Date(),

        status:
          assessment.status === "LAUNCHED"
            ? ("IN_PROGRESS" as any)
            : assessment.status,
      } as any,
    });
  }

  const questions =
    assessment.template?.sections.flatMap((section: any) =>
      (section.questions || []).map((question: any) => ({
        id: question.id,
        text: question.text,
        prompt: question.text,
        helpText: question.helpText,
        type: question.type,
        required: Boolean(question.required),
        orderIndex: question.orderIndex ?? 0,
        sectionTitle: section.title,
        sectionDescription: section.description,
        options: parseOptions(question.options),
      }))
    ) || [];
  const releaseRows = await prisma.$queryRawUnsafe<
    Array<{
      assignmentId: number | null;
      requestId: number | null;
      assignmentStatus: string | null;
      releaseState: string | null;
      intent: string | null;
    }>
  >(
    `
    select
      ra.id as "assignmentId",
      rr.id as "requestId",
      ra.status::text as "assignmentStatus",
      coalesce(resp.responses->>'releaseState', '')::text as "releaseState",
      coalesce(resp.responses->>'intent', '')::text as intent
    from "ReviewRequest" rr
    join "ReviewAssignment" ra on ra."reviewRequestId" = rr.id
    left join lateral (
      select r.responses
      from "ReviewResponse" r
      where r."reviewAssignmentId" = ra.id
      order by r."updatedAt" desc, r.id desc
      limit 1
    ) resp on true
    where rr."vendorId" = $1
    order by ra."updatedAt" desc, ra.id desc
    limit 1
    `,
    assessment.vendor.id,
  );

  const latestRelease = releaseRows[0] ?? null;

  const portalAssignmentId =
    latestRelease?.assignmentId != null ? Number(latestRelease.assignmentId) : null;

  const portalRequestId =
    latestRelease?.requestId != null ? Number(latestRelease.requestId) : null;

  const releaseState = String(latestRelease?.releaseState ?? "").toUpperCase();
  const releaseIntent = String(latestRelease?.intent ?? "").toUpperCase();
  const assignmentStatus = String(latestRelease?.assignmentStatus ?? "").toUpperCase();

  const isReleased =
    releaseState.includes("RELEASE") ||
    releaseState.includes("CONFIRMED") ||
    releaseIntent.includes("RELEASE") ||
    assignmentStatus === "COMPLETED" ||
    ["SUBMITTED", "REVIEW_READY", "COMPLETED", "RELEASED", "CONFIRMED"].includes(
      String(assessment.status ?? "").toUpperCase(),
    );
  const answerByQuestionId = new Map(
    (assessment.answers || []).map((answer: any) => [
      Number(answer.questionId),
      answer,
    ]),
  );

  const answeredForScore = Array.from(answerByQuestionId.values()).filter(
    (answer: any) =>
      answer?.value != null ||
      answer?.answer != null ||
      answer?.text != null ||
      answer?.response != null,
  ).length;

  const displayScore =
    assessment.score != null
      ? assessment.score
      : questions.length > 0
        ? Math.round((answeredForScore / questions.length) * 100)
        : null;
    const vendorRemediationPackages = await prisma.$queryRaw<Array<{
    id: number;
    evidenceRequestId: number | null;
    title: string;
    status: string | null;
    severity: string | null;
    dueAt: Date | string | null;
    payload: any;
    createdAt: Date | string | null;
    updatedAt: Date | string | null;
  }>>`
    select
      rp.id,
      rp."evidenceRequestId",
      rp.title,
      rp.status,
      rp.severity,
      rp."dueAt",
      rp.payload,
      rp."createdAt",
      rp."updatedAt"
    from "RemediationPackage" rp
    where rp."vendorId" = ${assessment.vendor.id}
      and upper(coalesce(rp.status, '')) <> 'CANCELLED'
    order by rp."createdAt" desc, rp.id desc
  `;
const evidenceRequestRows = await prisma.$queryRawUnsafe<
    Array<{
      id: number;
      status: string | null;
      title: string | null;
      notes: string | null;
      reviewNote: string | null;
      dueAt: Date | string | null;
      fulfilledEvidenceId: number | null;
      fulfilledAt: Date | string | null;
      createdAt: Date | string | null;
      packageId: number | null;
      packageTitle: string | null;
      packageStatus: string | null;
      packageSeverity: string | null;
      packagePayload: any;
    }>
  >(
    `
    select
      er.id,
      er.status::text as status,
      er.title,
      er.notes,
      er."reviewNote",
      er."dueAt",
      er."fulfilledEvidenceId",
      er."fulfilledAt",
      er."createdAt",
      rp.id as "packageId",
      rp.title as "packageTitle",
      rp.status as "packageStatus",
      rp.severity as "packageSeverity",
      rp.payload as "packagePayload"
    from "EvidenceRequest" er
    left join "RemediationPackage" rp on rp."evidenceRequestId" = er.id
    left join "AssessmentRun" ar on ar.id = er."assessmentRunId"
    where (ar."assessmentId" = $1
       or er."vendorId" = $2)
      and upper(coalesce(er.status::text, '')) <> 'CANCELLED'
    order by er."createdAt" desc
    `,
    assessment.id,
    assessment.vendor.id,
  );

    const packageLinkedEvidenceRequestIds = new Set(
    vendorRemediationPackages
      .map((pkg) => Number(pkg.evidenceRequestId ?? 0))
      .filter((id) => id > 0),
  );

  const remediationPackageCards = vendorRemediationPackages.map((pkg) => {
    const payload = pkg.payload && typeof pkg.payload === "object" ? pkg.payload : {};

    return {
      id: Number(pkg.evidenceRequestId ?? pkg.id),
      packageId: pkg.id,
      title: payload.vendorTitle || payload.title || pkg.title,
      status: String(pkg.status || "REQUESTED").toUpperCase(),
      kind: "REMEDIATION",
      dueAt: pkg.dueAt,
      fulfilledAt: null,
      createdAt: pkg.createdAt,
      packagePayload: payload,
      packageTitle: pkg.title,
      packageStatus: pkg.status,
      packageSeverity: pkg.severity,
      notes:
        payload.vendorSummary ||
        payload.businessReason ||
        "Truvern needs additional remediation evidence before the review can be completed.",
    };
  });

  const legacyEvidenceRequests = evidenceRequestRows.filter((request: any) => {
    const id = Number(request.id ?? 0);
    const status = String(request.status ?? "").toUpperCase();
    const notes = String(request.notes ?? "");

    if (status === "CANCELLED") return false;
    if (packageLinkedEvidenceRequestIds.has(id)) return false;
    if (notes.includes("Superseded by grouped remediation package")) return false;
    if (notes.includes("Auto-created by Truvern Findings Engine")) return false;

    return true;
  });

  const vendorVisibleEvidenceRequests =
    remediationPackageCards.length > 0
      ? remediationPackageCards
      : legacyEvidenceRequests;
const openEvidenceRequests = vendorVisibleEvidenceRequests.filter(
    (row: any) =>
      !["COMPLETED", "FULFILLED", "CLOSED", "APPROVED", "RESOLVED"].includes(
        String(row.status ?? "").toUpperCase(),
      ),
  ).length;

  const completedEvidenceRequests = vendorVisibleEvidenceRequests.filter((row: any) =>
    ["COMPLETED", "FULFILLED", "CLOSED", "APPROVED", "RESOLVED"].includes(
      String(row.status ?? "").toUpperCase(),
    ),
  ).length;

  const governanceReleased =
    releaseState.includes("RELEASED") ||
    releaseState.includes("CONFIRMED") ||
    assignmentStatus === "RELEASED" ||
    assignmentStatus === "COMPLETED";

  const remediationRequired = openEvidenceRequests > 0;

  const governanceStage =
    governanceReleased ? 4 : remediationRequired ? 3 : 2;

  const governanceStatusLabel =
    governanceStage === 4
      ? "Governance finalized"
      : governanceStage === 3
        ? "Remediation requested"
        : "Under governance review";

  const governanceNextStep =
    governanceStage === 4
      ? "Final governance determination issued"
      : governanceStage === 3
        ? "Vendor remediation and evidence upload"
        : "Truvern reviewer validation";

  const governanceFollowUp =
    governanceStage === 4
      ? "Governance release artifacts and audit records available"
      : governanceStage === 3
        ? "Additional evidence and remediation required"
        : "Evidence or remediation requests if needed";
return (
    <main className="min-h-screen bg-[#020817] px-6 py-12 text-white">
      <VendorAssessmentAutoRefresh enabled={!governanceReleased} intervalMs={20000} />
      <div className="mx-auto max-w-6xl">

        <section className="mb-8 rounded-[2rem] border border-cyan-400/20 bg-cyan-500/10 p-6 shadow-2xl shadow-cyan-500/10">
          <div className="max-w-4xl">
            <div className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-200">
              Truvern Vendor Governance Review
            </div>

            <h1 className="mt-4 text-3xl font-black tracking-tight text-white">
              Your organization has been requested for governance review.
            </h1>

            <p className="mt-5 text-sm leading-7 text-slate-300">
              Truvern manages vendor governance operations on behalf of customer
              organizations. This assessment may include questionnaire review,
              evidence validation, remediation coordination, and governance
              release evaluation for procurement, security, compliance, audit,
              or executive review workflows.
            </p>

            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {[
                "Evidence review",
                "Remediation coordination",
                "Attestation requests",
                "Governance release evaluation",
              ].map((item) => (
                <div
                  key={item}
                  className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm font-semibold text-slate-100"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="mb-6 rounded-3xl border border-white/10 bg-white/[0.03] p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="inline-flex items-center rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-emerald-200">
                {assessment.status === "SUBMITTED" || assessment.status === "REVIEW_READY"
  ? "Assessment submitted"
  : "Assessment in progress"}
              </div>

              <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white">
                {assessment.title || assessment.template?.name || "Vendor Assessment"}
              </h1>

              <div className="mt-2 text-base text-slate-300">
                Vendor:{" "}
                <span className="font-semibold text-emerald-300">
                  {assessment.vendor.name}
                </span>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-semibold text-slate-300">
                  Assessment #{assessment.id}
                </span>

                {portalAssignmentId ? (
                  <span className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-xs font-semibold text-cyan-100">
                    Assignment #{portalAssignmentId}
                  </span>
                ) : null}

                {portalRequestId ? (
                  <span className="rounded-full border border-violet-300/20 bg-violet-400/10 px-3 py-1 text-xs font-semibold text-violet-100">
                    Request #{portalRequestId}
                  </span>
                ) : null}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 px-5 py-4 text-right">
              <div className="text-xs uppercase tracking-[0.24em] text-slate-400">
                Completion
              </div>

              <div className="mt-2 text-3xl font-semibold text-white">
                {displayScore != null ? `${displayScore}%` : "Not scored yet"}
              </div>
            </div>
          </div>
        </div>

        {isReleased ? (
          <div className="rounded-3xl border border-emerald-400/20 bg-emerald-500/10 p-8 text-emerald-100">
            <div className="text-xs uppercase tracking-[0.3em] text-emerald-200/80">
              Submission received
            </div>

            <h2 className="mt-3 text-3xl font-semibold text-white">
              Assessment submitted
            </h2>

            <p className="mt-4 max-w-3xl text-sm leading-7 text-emerald-100/80">
              Your vendor review has been successfully submitted and is currently under governance review. Responses are preserved as part of the governance record and can no longer be edited for this submission cycle.
            </p>

<div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.03] p-6">
  <p className="text-xs uppercase tracking-[0.35em] text-cyan-200">
    Governance review progress
  </p>

  <div className="mt-6 grid gap-4 md:grid-cols-4">
    {[
      ["Submitted", "Complete"],
      [
        "Under governance review",
        governanceStage === 2 ? "Current" : governanceStage > 2 ? "Complete" : "Pending",
      ],
      [
        "Findings / remediation",
        governanceStage === 3
          ? "Action required"
          : governanceStage > 3
            ? "Resolved"
            : "If needed",
      ],
      [
        "Governance finalized",
        governanceStage === 4 ? "Complete" : "Pending",
      ],
    ].map(([label, status], index) => {
      const stageNumber = index + 1;
      const active = governanceStage >= stageNumber;
      const current = governanceStage === stageNumber && governanceStage !== 4;
return (
        <div
          key={label}
          className={`rounded-2xl border p-4 ${
            current
              ? "border-amber-300/30 bg-amber-400/10"
              : active
                ? "border-cyan-300/25 bg-cyan-400/10"
                : "border-white/10 bg-white/[0.03]"
          }`}
        >
          <div
            className={`mb-4 flex h-9 w-9 items-center justify-center rounded-full border text-sm font-bold ${
              current
                ? "border-amber-300/40 bg-amber-300/10 text-amber-100"
                : active
                  ? "border-cyan-300/40 bg-cyan-300/10 text-cyan-100"
                  : "border-white/10 bg-white/[0.03] text-slate-400"
            }`}
          >
            {index + 1}
          </div>

          <p className="text-sm font-semibold text-white">{label}</p>
          <p className="mt-2 text-xs uppercase tracking-[0.22em] text-slate-400">
            {status}
          </p>
        </div>
      );
    })}
  </div>

  <div className="mt-6 grid gap-4 md:grid-cols-3">
    <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
      <p className="text-xs uppercase tracking-[0.25em] text-slate-500">
        Review status
      </p>
      <p className="mt-2 font-semibold text-cyan-100">{governanceStatusLabel}</p>
    </div>

    <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
      <p className="text-xs uppercase tracking-[0.25em] text-slate-500">
        Next step
      </p>
      <p className="mt-2 font-semibold text-white">
        {governanceNextStep}
      </p>
    </div>

    <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
      <p className="text-xs uppercase tracking-[0.25em] text-slate-500">
        Follow-up
      </p>
      <p className="mt-2 font-semibold text-white">
        {governanceFollowUp}
      </p>
    </div>
  </div>


<div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.03] p-6">
  <p className="text-xs uppercase tracking-[0.35em] text-cyan-200">
    Governance activity
  </p>

  <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">

    <div className="rounded-2xl border border-cyan-400/20 bg-cyan-500/10 p-5">
      <p className="text-xs uppercase tracking-[0.25em] text-cyan-200">
        Latest activity
      </p>

      <p className="mt-3 text-lg font-semibold text-white">
        {governanceReleased ? "Governance finalized" : remediationRequired ? "Remediation requested" : "Governance review started"}
      </p>

      <p className="mt-2 text-sm leading-6 text-cyan-50/70">
        {governanceReleased
          ? "The governance process has been finalized and release artifacts are now available."
          : remediationRequired
            ? "Reviewers requested additional evidence or remediation before release."
            : "Truvern reviewers are validating assessment responses and supporting evidence."}
      </p>
    </div>

    <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 p-5">
      <p className="text-xs uppercase tracking-[0.25em] text-amber-100">
        Open remediation
      </p>

      <p className="mt-3 text-4xl font-semibold text-white">
        {remediationRequired ? openEvidenceRequests : 0}
      </p>

      <p className="mt-2 text-sm leading-6 text-amber-50/70">
        {remediationRequired
          ? "Open remediation items require vendor action before release."
          : "No remediation actions have been requested yet."}
      </p>
    </div>

    <div className="rounded-2xl border border-violet-400/20 bg-violet-500/10 p-5">
      <p className="text-xs uppercase tracking-[0.25em] text-violet-100">
        Evidence requests
      </p>

      <p className="mt-3 text-4xl font-semibold text-white">
        {openEvidenceRequests}
      </p>

      <p className="mt-2 text-sm leading-6 text-violet-50/70">
        {openEvidenceRequests > 0
          ? `${openEvidenceRequests} open evidence request${openEvidenceRequests === 1 ? "" : "s"} require attention.`
          : completedEvidenceRequests > 0
            ? `${completedEvidenceRequests} evidence request${completedEvidenceRequests === 1 ? "" : "s"} completed.`
            : "Additional evidence requests will appear here if reviewers require more validation."}
      </p>
    </div>

    <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-5">
      <p className="text-xs uppercase tracking-[0.25em] text-emerald-100">
        Estimated SLA
      </p>

      <p className="mt-3 text-lg font-semibold text-white">
        {governanceStatusLabel}
      </p>

      <p className="mt-2 text-sm leading-6 text-emerald-50/70">
        {governanceNextStep}
      </p>
    </div>

  </div>

  <div className="mt-6 rounded-2xl border border-cyan-400/20 bg-cyan-500/10 p-5">
    <div className="flex flex-wrap items-start justify-between gap-4">
        <VendorRemediationProgress items={vendorVisibleEvidenceRequests} />

      <div>
        <p className="text-xs uppercase tracking-[0.25em] text-cyan-100">
          Remediation workspace
        </p>

        <p className="mt-2 text-lg font-semibold text-white">
          {openEvidenceRequests > 0
            ? `${openEvidenceRequests} request${openEvidenceRequests === 1 ? "" : "s"} awaiting vendor response`
            : "No open evidence requests"}
        </p>

        <p className="mt-2 max-w-3xl text-sm leading-6 text-cyan-50/75">
          Complete the remediation packages below so Truvern can validate the review and move the assessment toward release.
        </p>
      </div>

      <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs font-semibold text-cyan-100">
        {vendorVisibleEvidenceRequests.length} total
      </span>
    </div>

    {vendorVisibleEvidenceRequests.length > 0 ? (
      <div className="mt-5 grid gap-3">
        {vendorVisibleEvidenceRequests.map((request: any) => (
          <VendorRemediationCard
            key={request.id}
            request={request}
            vendorId={assessment.vendor.id}
          />
        ))}
      </div>
    ) : (
      <div className="mt-5 rounded-2xl border border-dashed border-white/10 bg-slate-950/40 p-4 text-sm text-slate-400">
        No additional evidence has been requested yet.
      </div>
    )}
  </div>
  <div className="mt-6 rounded-2xl border border-white/10 bg-slate-950/40 p-5">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div>
        <p className="text-xs uppercase tracking-[0.25em] text-slate-500">
          Final governance release
        </p>

        <p className="mt-2 text-lg font-semibold text-white">
          {governanceReleased ? "Governance release available" : "Release packet unavailable"}
        </p>

        <p className="mt-2 text-sm leading-6 text-slate-400">
          {governanceReleased
            ? "Immutable governance release artifacts, audit history, and finalized governance records are now available."
            : "Immutable governance release artifacts and audit packets will become available after governance review is finalized."}
        </p>
      </div>

      <button
        disabled
        className="rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-semibold text-slate-500"
      >
        {governanceReleased ? "Released" : "Awaiting release"}
      </button>
    </div>
  </div>
</div>

</div>
          </div>
        ) : (
          <VendorAssessmentRunClient
            assessmentId={assessment.id}
            vendorId={assessment.vendor.id}
            token={token}
            submitted={assessment.status === "SUBMITTED" || assessment.status === "REVIEW_READY"}
            questions={questions}
            initialAnswers={assessment.answers || []}
          />
        )}
      </div>
    </main>
  );
}
















































