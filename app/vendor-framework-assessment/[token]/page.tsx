import { notFound } from "next/navigation";
import VendorAssessmentQuestionCard from "@/components/vendor-assessment/question-card";
import { findVendorFrameworkAssessmentByToken } from "@/lib/auth/vendor-framework-assessment-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = {
  params: Promise<{ token: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function hasAnswer(value: unknown) {
  if (value === null || value === undefined) {
    return false;
  }

  if (typeof value === "string") {
    return value.trim().length > 0;
  }

  return true;
}

export default async function VendorFrameworkAssessmentPage({
  params,
  searchParams,
}: Props) {
  const { token } = await params;
  const query = (await searchParams) ?? {};

  const assessment =
    await findVendorFrameworkAssessmentByToken(token);

  if (!assessment) {
    notFound();
  }

  const answeredCount =
    assessment.responses.filter(
      (response) => hasAnswer(response.answer),
    ).length;

  const missingCount =
    typeof query.missing === "string"
      ? query.missing
      : "";

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
            Truvern Vendor Assessment
          </p>

          <h1 className="mt-3 text-2xl font-semibold">
            {assessment.title}
          </h1>

          <p className="mt-2 text-sm text-slate-300">
            {assessment.framework.name}
          </p>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="text-xs uppercase tracking-wide text-slate-400">
                Status
              </div>
              <div className="mt-1 font-semibold">
                {assessment.status}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="text-xs uppercase tracking-wide text-slate-400">
                Progress
              </div>
              <div className="mt-1 font-semibold">
                {answeredCount} / {assessment.responses.length}
              </div>
            </div>
          </div>

          {missingCount ? (
            <div className="mt-5 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-100">
              {missingCount} required response(s) remain incomplete.
            </div>
          ) : null}
        </section>

        <section className="space-y-4">
          {assessment.responses.map((response) => (
            <VendorAssessmentQuestionCard
              key={response.id}
              assessmentId={assessment.id}
              response={response}
              vendorToken={token}
            />
          ))}
        </section>

        {!assessment.submittedAt ? (
          <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
            <form
              action={`/api/vendor-framework-assessment/${encodeURIComponent(token)}/submit`}
              method="post"
            >
              <button
                type="submit"
                className="rounded-xl bg-cyan-400 px-5 py-3 font-semibold text-slate-950 hover:bg-cyan-300"
              >
                Submit assessment
              </button>
            </form>
          </section>
        ) : (
          <section className="rounded-3xl border border-emerald-400/30 bg-emerald-400/10 p-6 text-sm text-emerald-100">
            This assessment has been submitted to Truvern for review.
          </section>
        )}
      </div>
    </main>
  );
}