import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import VendorAssessmentQuestionCard from "@/components/vendor-assessment/question-card";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function parseId(value: string) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function statusLabel(status: string) {
  return status.replaceAll("_", " ");
}

export default async function VendorFrameworkAssessmentPage({ params, searchParams }: Props) {
  const { id: rawId } = await params;
  const query = searchParams ? await searchParams : {};
  const submitted = query.submitted === "1";
  const reopenRequested = query.reopenRequested === "1";
  const submitError = query.submitError === "incomplete";
  const missingCount = typeof query.missing === "string" ? query.missing : "";
  const id = parseId(rawId);

  if (!id) notFound();

  const assessment = await prisma.truvernFrameworkAssessment.findUnique({
    where: { id },
    include: {
      framework: true,
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
      findings: {
        orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
        take: 20,
      },
      attestations: {
        orderBy: [{ createdAt: "desc" }],
        take: 20,
      },
    },
  });

  if (!assessment) notFound();

  const answered = assessment.responses.filter((response) => {
    if (response.answer === null || response.answer === undefined) return false;
    if (typeof response.answer === "string") return response.answer.trim().length > 0;
    return true;
  }).length;

  const completionPercent =
    assessment.responses.length > 0 ? Math.round((answered / assessment.responses.length) * 100) : 0;

  const metadata =
    assessment.metadata && typeof assessment.metadata === "object"
      ? (assessment.metadata as Record<string, unknown>)
      : {};

  const requestedBy =
    typeof metadata.requestedBy === "string" && metadata.requestedBy.trim()
      ? metadata.requestedBy.trim()
      : "the requesting customer";

  const metadataDueAt =
    typeof metadata.managedReviewDueAt === "string"
      ? metadata.managedReviewDueAt
      : null;

  const dueAt = metadataDueAt ? new Date(metadataDueAt) : null;
  const now = new Date();
  const isSubmitted = statusLabel(assessment.status).toUpperCase() === "SUBMITTED";
  const isExpired = Boolean(dueAt && dueAt.getTime() < now.getTime() && !isSubmitted);

  const remainingMs = dueAt ? dueAt.getTime() - now.getTime() : null;
  const remainingDays =
    remainingMs && remainingMs > 0
      ? Math.ceil(remainingMs / (1000 * 60 * 60 * 24))
      : 0;

  const dueLabel = dueAt
    ? dueAt.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "Not set";

  return (
    <main className="min-h-screen bg-[#020617] px-6 py-8 text-white">
      <div className="mx-auto max-w-6xl space-y-8">
        <section className="rounded-[2rem] border border-cyan-300/15 bg-cyan-300/[0.06] p-8">
          <p className="text-xs uppercase tracking-[0.3em] text-cyan-200">
            Vendor governance assessment
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white md:text-5xl">
            {assessment.title}
          </h1>
          <p className="mt-4 max-w-4xl text-base leading-7 text-slate-300">
            {requestedBy} has requested this Truvern-managed vendor risk assessment.
            Please complete the control questions, provide evidence descriptions where available,
            upload supporting files when requested, and submit when ready for Truvern reviewer scoring.
          </p>

          <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-5 text-sm leading-7 text-slate-300">
            Truvern coordinates this assessment as an operational governance review.
            Responses, supporting evidence, remediation activity, and attestations may be reviewed
            by authorized Truvern analysts and the requesting customer organization.
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-5">
            <Metric label="Requested by" value={requestedBy} />
            <Metric label="Framework" value={assessment.framework.name} />
            <Metric label="Status" value={statusLabel(assessment.status)} />
            <Metric label="Due date" value={dueLabel} />
            <Metric label="Completion" value={`${completionPercent}%`} />
            <Metric label="Questions" value={assessment.responses.length} />
          </div>

          {submitted ? (
            <div className="mt-6 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-5 text-sm font-semibold text-emerald-100">
              Assessment submitted successfully. Truvern Ops has received your responses for review.
            </div>
          ) : null}

          {submitError ? (
            <div className="mt-6 rounded-2xl border border-amber-400/20 bg-amber-500/10 p-5 text-sm font-semibold text-amber-100">
              Please answer all required questions before submitting. {missingCount ? `${missingCount} question(s) still need an answer.` : ""}
            </div>
          ) : null}

          {dueAt && !isSubmitted && !isExpired ? (
            <div className="mt-6 rounded-2xl border border-cyan-400/20 bg-cyan-500/10 p-5 text-sm font-semibold text-cyan-100">
              This Truvern Review is due in {remainingDays} day(s). It will close automatically unless Truvern Ops reopens it.
            </div>
          ) : null}

          {isExpired ? (
            <div className="mt-6 rounded-2xl border border-rose-400/20 bg-rose-500/10 p-5 text-sm leading-7 text-rose-100">
              This Truvern Review window has closed. Request reopening if you need more time to complete or revise your submission.

              {reopenRequested ? (
                <div className="mt-4 rounded-xl border border-emerald-400/20 bg-emerald-500/10 p-3 text-emerald-100">
                  Reopen request sent to Truvern Ops.
                </div>
              ) : (
                <form
                  action={`/api/truvern/framework-assessments/${assessment.id}/request-reopen`}
                  method="post"
                  className="mt-4"
                >
                  <button className="rounded-2xl border border-amber-400/30 bg-amber-500/15 px-5 py-3 text-sm font-semibold text-amber-50 hover:bg-amber-500/20">
                    Request reopen
                  </button>
                </form>
              )}
            </div>
          ) : null}

          <form action={`/api/truvern/framework-assessments/${assessment.id}/submit`} method="post" className="mt-6">
            <button
              disabled={isExpired || isSubmitted}
              className="rounded-2xl border border-emerald-400/30 bg-emerald-500/15 px-5 py-3 text-sm font-semibold text-emerald-50 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitted ? "Submitted to Truvern review" : "Submit to Truvern review"}
            </button>
          </form>
        </section>

        {assessment.findings.length || assessment.attestations.length ? (
          <section className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-3xl border border-amber-400/15 bg-amber-500/10 p-6">
              <h2 className="text-xl font-semibold text-white">Reviewer findings</h2>
              <div className="mt-4 space-y-3">
                {assessment.findings.length ? (
                  assessment.findings.map((finding) => (
                    <div key={finding.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-100">
                        {finding.severity} · {finding.status}
                      </div>
                      <div className="mt-2 font-semibold text-white">{finding.title}</div>
                      <p className="mt-1 text-sm leading-6 text-slate-400">{finding.description}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-400">No findings have been generated yet.</p>
                )}
              </div>
            </div>

            <div className="rounded-3xl border border-violet-400/15 bg-violet-500/10 p-6">
              <h2 className="text-xl font-semibold text-white">Attestation requests</h2>
              <div className="mt-4 space-y-3">
                {assessment.attestations.length ? (
                  assessment.attestations.map((attestation) => (
                    <div key={attestation.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-100">
                        {attestation.status}
                      </div>
                      <div className="mt-2 font-semibold text-white">{attestation.title}</div>
                      {attestation.description ? (
                        <p className="mt-1 text-sm leading-6 text-slate-400">{attestation.description}</p>
                      ) : null}
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-400">No attestation requests yet.</p>
                )}
              </div>
            </div>
          </section>
        ) : null}

        <section className="space-y-4">
          {assessment.responses.map((response) => (
            <VendorAssessmentQuestionCard
              key={response.id}
              assessmentId={assessment.id}
              response={{
                id: response.id,
                questionId: response.questionId,
                answer: response.answer,
                vendorNotes: response.vendorNotes,
                evidence: response.evidence,
                question: {
                  prompt: response.question.prompt,
                  helpText: response.question.helpText,
                  evidencePrompt: response.question.evidencePrompt,
                  requiresEvidence: response.question.requiresEvidence,
                  requiresAttestation: response.question.requiresAttestation,
                  weight: response.question.weight,
                  control: {
                    controlId: response.question.control.controlId,
                    family: response.question.control.family,
                    title: response.question.control.title,
                  },
                },
              }}
            />
          ))}
        </section>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
      <div className="text-sm font-semibold text-white">{value}</div>
      <div className="mt-1 text-[10px] uppercase tracking-[0.18em] text-slate-500">{label}</div>
    </div>
  );
}









