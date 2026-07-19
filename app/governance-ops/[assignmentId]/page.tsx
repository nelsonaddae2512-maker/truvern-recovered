import Link from "next/link";
import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import ReviewAssignmentWorkspace from "@/components/review-desk/review-assignment-workspace.client";
import ManagedReviewAssessmentLauncher from "@/components/managed-reviews/managed-review-assessment-launcher.client";
import { isTruvernOperator } from "@/lib/truvern-ops-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = {
  params: Promise<{ assignmentId: string }> | { assignmentId: string };
};

type AnyRow = Record<string, any>;

function safeInt(v: unknown) {
  const n = Number(String(v ?? "").trim());
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

function safeStr(v: unknown) {
  return typeof v === "string" ? v.trim() : "";
}

function upper(v: unknown) {
  return safeStr(v).toUpperCase();
}

function iso(v: unknown) {
  if (!v) return null;
  const d = new Date(v as any);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

async function one<T = AnyRow>(query: TemplateStringsArray, ...values: any[]) {
  const rows = await prisma.$queryRaw<T[]>(query, ...values);
  return rows[0] ?? null;
}

async function countRaw(query: TemplateStringsArray, ...values: any[]) {
  const rows = await prisma.$queryRaw<Array<{ count: string | number }>>(
    query,
    ...values,
  );

  return Number(rows[0]?.count ?? 0);
}

export default async function ReviewEngagementPage({ params }: Props) {
  const resolved = await params;
  const assignmentId = safeInt(resolved.assignmentId);

  if (!assignmentId) notFound();

  const canManageTruvernReview = await isTruvernOperator();

  const assignment = await one<AnyRow>`
    select *
    from "ReviewAssignment"
    where id = ${assignmentId}
    limit 1
  `;

  if (!assignment) notFound();

  const requestId =
    safeInt(assignment.requestId) ?? safeInt(assignment.reviewRequestId);

  const request = requestId
    ? await one<AnyRow>`
        select *
        from "ReviewRequest"
        where id = ${requestId}
        limit 1
      `
    : null;

  const vendorId = safeInt(assignment.vendorId) ?? safeInt(request?.vendorId);

  if (!vendorId) notFound();

  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    select: {
      id: true,
      name: true,
      category: true,
      updatedAt: true,
    },
  });

  if (!vendor) notFound();

  const latestOutcome = await one<AnyRow>`
    select *
    from "ReviewResponse"
    where "reviewAssignmentId" = ${assignmentId}
    order by "updatedAt" desc
    limit 1
  `;

  const latestOutcomeResponses =
    latestOutcome &&
    typeof latestOutcome.responses === "object" &&
    latestOutcome.responses !== null
      ? latestOutcome.responses
      : {};

  const evidenceCount = await countRaw`
    select count(*)::text as count
    from "Evidence"
    where "vendorId" = ${vendorId}
  `;

  const pendingEvidenceRequests = await countRaw`
    select count(*)::text as count
    from "EvidenceRequest"
    where "vendorId" = ${vendorId}
      and upper(coalesce(status::text, '')) in ('REQUESTED','PENDING','OPEN')
  `;

  const completedEvidenceRequests = await countRaw`
    select count(*)::text as count
    from "EvidenceRequest"
    where "vendorId" = ${vendorId}
      and upper(coalesce(status::text, '')) in ('COMPLETED','FULFILLED','CLOSED','APPROVED','RESOLVED')
  `;

  const latestManagedAssessment = await prisma.truvernFrameworkAssessment.findFirst({
    where: {
      reviewAssignmentId: assignmentId,
    },
    orderBy: {
      updatedAt: "desc",
    },
    select: {
      id: true,
    },
  });

  const submittedFrameworkAssessment = await prisma.truvernFrameworkAssessment.findFirst({
    where: {
      reviewAssignmentId: assignmentId,
      status: "SUBMITTED",
    },
    orderBy: {
      submittedAt: "desc",
    },
    include: {
      responses: {
        include: {
          question: {
            include: {
              control: true,
            },
          },
        },
        orderBy: [{ questionId: "asc" }],
      },
    },
  });

  const frameworkVendorAnswers =
    submittedFrameworkAssessment?.responses.map((response) => ({
      assessmentId: submittedFrameworkAssessment.id,
      assessmentStatus: submittedFrameworkAssessment.status,
      score: response.score,
      questionId: response.questionId,
      prompt: response.question.prompt,
      questionType: response.question.control.controlId,
      value:
        typeof response.answer === "string"
          ? response.answer
          : response.answer == null
            ? null
            : JSON.stringify(response.answer),
      createdAt: iso(response.createdAt),
      updatedAt: iso(response.updatedAt),
    })) ?? [];


  const governanceMemoryRows = await prisma.$queryRawUnsafe<
    Array<{
      governanceScore: number | null;
      governanceDecision: string | null;
      residualRisk: string | null;
      criticalFailures: number | null;
      partialControls: number | null;
      missingEvidenceCount: number | null;
      remediationCount: number | null;
      breachDisclosureDetected: boolean | null;
      federalInvestigationDetected: boolean | null;
      governanceNarrative: string | null;
      createdAt: string | Date | null;
    }>
  >(
    `
    select
      "governanceScore",
      "governanceDecision",
      "residualRisk",
      "criticalFailures",
      "partialControls",
      "missingEvidenceCount",
      "remediationCount",
      "breachDisclosureDetected",
      "federalInvestigationDetected",
      "governanceNarrative",
      "createdAt"
    from "VendorGovernanceMemory"
    where "vendorId" = $1
    order by "createdAt" desc
    limit 12
    `,
    vendorId,
  );

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const latestVendorUrl = latestManagedAssessment?.id
    ? `${appUrl}/vendor-assessments/${latestManagedAssessment.id}`
    : null;

  const creditLedgerRows = await prisma.$queryRawUnsafe<
    Array<{
      entryType: string;
      availableDelta: number;
      reservedDelta: number;
      consumedDelta: number;
      quantity: number;
      note: string | null;
      createdAt: Date | string | null;
    }>
  >(
    `
    select
      "entryType"::text as "entryType",
      "availableDelta",
      "reservedDelta",
      "consumedDelta",
      quantity,
      note,
      "createdAt"
    from "TruvernCreditLedgerEntry"
    where "reviewAssignmentId" = $1
      and status = 'POSTED'::text
    order by "createdAt" asc, id asc
    `,
    assignmentId,
  );

  const customerVisibleReleaseState = upper(
    latestOutcomeResponses?.releaseState ||
      latestOutcomeResponses?.governanceReleaseSnapshot?.releaseState,
  );

  const customerCanViewReleasedOutcome =
    customerVisibleReleaseState === "RELEASED" ||
    customerVisibleReleaseState === "AWAITING_CONFIRMATION" ||
    customerVisibleReleaseState === "CONFIRMED";

  if (
    !canManageTruvernReview &&
    upper(assignment.assignmentType) === "TRUVERN" &&
    !customerCanViewReleasedOutcome
  ) {
    return (
      <main className="min-h-screen bg-[#020617] px-6 py-16 text-white">
        <div className="mx-auto max-w-4xl">
          <Link href={`/vendors/${vendor.id}`} className="text-sm text-cyan-200">
            ← Back to vendor
          </Link>

          <section className="mt-8 rounded-[2rem] border border-cyan-400/20 bg-cyan-500/10 p-10 shadow-2xl shadow-cyan-950/40">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-200">
              Sent to Truvern Ops
            </p>

            <h1 className="mt-5 text-5xl font-black tracking-tight text-white">
              Truvern is handling this review from here.
            </h1>

            <p className="mt-6 max-w-3xl text-base leading-8 text-slate-300">
              Your vendor has been submitted to Truvern for managed governance
              review. Truvern Ops will coordinate the assessment workflow,
              vendor outreach, evidence review, findings, remediation, and the
              final governance release package.
            </p>

            <div className="mt-8 grid gap-4 md:grid-cols-2">
              {[
                "Truvern Ops notified",
                "Truvern Review assignment created",
                "Credit reservation recorded when required",
                "Governance release workflow started",
              ].map((item) => (
                <div
                  key={item}
                  className="rounded-2xl border border-white/10 bg-white/[0.05] p-5 text-sm font-semibold text-slate-100"
                >
                  {item}
                </div>
              ))}
            </div>

            <div className="mt-8 rounded-2xl border border-white/10 bg-slate-950/40 p-5 text-sm leading-7 text-slate-300">
              Assignment #{assignmentId}. Truvern reviews are operational
              governance assessments and are not certifications, guarantees,
              legal determinations, or regulatory warranties.
            </div>
          </section>
        </div>
      </main>
    );
  }
  return (
    <main className="min-h-screen bg-[#020617] px-6 py-10 text-white">
      <div className="mx-auto max-w-7xl">
        <Link href="/review-desk" className="text-sm text-cyan-200">
          ← Back to Governance Ops
        </Link>

        <section className="mt-8 rounded-[2rem] border border-cyan-400/20 bg-cyan-500/10 p-8 shadow-2xl shadow-cyan-950/40">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-200">
            Truvern governance engagement
          </p>

          <div className="mt-4 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-5xl font-black tracking-tight text-white">
                {vendor.name}
              </h1>

              <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300">
                Dedicated Truvern Review workspace for evidence review,
                findings, remediation, attestations, and governance release
                operations.
              </p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.04] px-5 py-4 text-sm text-slate-200">
              Assignment #{assignmentId}
            </div>
          </div>
        </section>

        <div className="mt-8 grid gap-8 xl:grid-cols-[340px_minmax(0,1fr)]">
          <aside className="space-y-6">
            <section className="sticky top-24 rounded-[2rem] border border-white/10 bg-white/[0.04] p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-200">
                Engagement dossier
              </p>

              <div className="mt-6 space-y-3">
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <div className="text-xs uppercase tracking-[0.25em] text-slate-500">
                    Vendor
                  </div>
                  <div className="mt-2 text-sm font-semibold text-white">
                    #{vendor.id}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <div className="text-xs uppercase tracking-[0.25em] text-slate-500">
                    Category
                  </div>
                  <div className="mt-2 text-sm font-semibold text-white">
                    {vendor.category ?? "Uncategorized"}
                  </div>
                </div>

                <div className="rounded-2xl border border-cyan-400/20 bg-cyan-500/10 p-4">
                  <div className="text-xs uppercase tracking-[0.25em] text-cyan-200">
                    Workflow
                  </div>
                  <div className="mt-2 text-sm font-semibold text-white">
                    {upper(assignment.assignmentType) === "TRUVERN"
                      ? "Truvern expert review"
                      : "Internal governance review"}
                  </div>
                </div>
              </div>
            </section>
          </aside>

          <div className="space-y-6">
          {upper(assignment.assignmentType) === "TRUVERN" ? (
            <ManagedReviewAssessmentLauncher
              vendorId={vendor.id}
              vendorName={vendor.name}
              assignmentId={assignmentId}
              initialAssessmentId={latestManagedAssessment?.id ?? null}
              initialVendorUrl={latestVendorUrl}
            />
          ) : null}

          <ReviewAssignmentWorkspace
            canManageTruvernReview={canManageTruvernReview}
            vendor={{
              id: vendor.id,
              name: vendor.name,
              category: vendor.category,
            }}
            assignment={{
              id: Number(assignment.id),
              status: upper(assignment.status) || "OPEN",
              assignmentType:
                upper(assignment.assignmentType) ||
                upper(assignment.type) ||
                "TRUVERN",
              assignedReviewerName:
                safeStr(assignment.assignedReviewerName) ||
                safeStr(assignment.reviewerName) ||
                safeStr(assignment.assignedTo) ||
                (upper(assignment.assignmentType) === "TRUVERN"
                  ? "Truvern expert"
                  : assignment.reviewerUserId
                    ? "Internal reviewer"
                    : "Unassigned"),
              createdAt: iso(assignment.createdAt),
              updatedAt: iso(assignment.updatedAt),
            }}
            request={{
              id: requestId,
              status: upper(request?.status) || "OPEN",
            }}
            vendorAnswers={frameworkVendorAnswers}
            governanceMemory={governanceMemoryRows.map((row) => ({
              governanceScore:
                typeof row.governanceScore === "number"
                  ? row.governanceScore
                  : null,
              governanceDecision: safeStr(row.governanceDecision),
              residualRisk: safeStr(row.residualRisk),
              criticalFailures: Number(row.criticalFailures ?? 0),
              partialControls: Number(row.partialControls ?? 0),
              missingEvidenceCount: Number(row.missingEvidenceCount ?? 0),
              remediationCount: Number(row.remediationCount ?? 0),
              breachDisclosureDetected: Boolean(row.breachDisclosureDetected),
              federalInvestigationDetected: Boolean(row.federalInvestigationDetected),
              governanceNarrative: safeStr(row.governanceNarrative),
              createdAt: iso(row.createdAt),
            }))}
            evidenceSummary={{
              totalEvidence: evidenceCount,
              pendingRequests: pendingEvidenceRequests,
              completedRequests: completedEvidenceRequests,
            }}
            latestOutcome={{
              id: latestOutcome?.id ? Number(latestOutcome.id) : null,
              status: upper(latestOutcomeResponses?.intent) || "DRAFT",
              decision: safeStr(latestOutcomeResponses?.decision) || null,
              riskLevel: safeStr(latestOutcomeResponses?.riskLevel) || null,
              releaseState:
                safeStr(latestOutcomeResponses?.releaseState) || null,
              findings:
                safeStr(latestOutcomeResponses?.findings) ||
                safeStr(latestOutcomeResponses?.summary) ||
                safeStr(latestOutcomeResponses?.executiveSummary) ||
                "",
              updatedAt: iso(latestOutcome?.updatedAt),
              generatedDraft: {
                schema: safeStr(latestOutcomeResponses?.schema),
                generatedAt:
                  iso(latestOutcomeResponses?.generatedAt) ||
                  iso(latestOutcome?.createdAt),
                summary:
                  safeStr(latestOutcomeResponses?.summary) ||
                  safeStr(latestOutcomeResponses?.executiveSummary) ||
                  safeStr(latestOutcomeResponses?.findings),
                recommendations: Array.isArray(
                  latestOutcomeResponses?.recommendations,
                )
                  ? latestOutcomeResponses.recommendations
                  : [],
                structuredAssessment:
                  latestOutcomeResponses?.structuredAssessment &&
                  typeof latestOutcomeResponses.structuredAssessment === "object"
                    ? latestOutcomeResponses.structuredAssessment
                    : null,
              },
            }}
            auditEvents={[
              {
                label: "Assignment created",
                at: iso(assignment.createdAt),
                detail:
                  "Review assignment was created from Governance Ops intake.",
              },
              ...creditLedgerRows.map((entry) => ({
                label:
                  upper(entry.entryType) === "RESERVATION"
                    ? "Credit reserved"
                    : upper(entry.entryType) === "CONSUMPTION"
                      ? "Credit consumed"
                      : upper(entry.entryType) === "REVERSAL"
                        ? "Credit reservation reversed"
                        : `Credit ledger ${upper(entry.entryType) || "ENTRY"}`,
                at: iso(entry.createdAt),
                detail:
                  entry.note ||
                  `Available ${entry.availableDelta}, reserved ${entry.reservedDelta}, consumed ${entry.consumedDelta}.`,
              })),
              {
                label: "Review started",
                at: iso(assignment.startedAt),
                detail: "Reviewer activity began on this assignment.",
              },
              {
                label: "Draft saved",
                at: iso(latestOutcome?.draftSavedAt),
                detail:
                  "Findings and outcome fields were saved as a draft.",
              },
              {
                label: "Review submitted",
                at: iso(latestOutcome?.submittedAt ?? assignment.submittedAt),
                detail: "Review was marked complete or released.",
              },
              {
                label: "Outcome released",
                at: iso(latestOutcomeResponses?.releasedAt),
                detail: "Governance outcome was released and locked.",
              },
              {
                label: "Governance confirmed",
                at: iso(latestOutcomeResponses?.confirmedAt),
                detail:
                  "Released outcome was confirmed for audit closeout.",
              },
              {
                label: "Governance seal generated",
                at: iso(latestOutcomeResponses?.governanceSeal?.sealedAt),
                detail:
                  "Immutable governance checksum, notarization receipt, and transparency ledger entry were generated.",
              },
            ]}
          />
          </div>
        </div>
      </div>
    </main>
  );
}











