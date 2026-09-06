import Link from "next/link";
import prisma from "@/lib/prisma";
import CreateFrameworkAssessmentButton from "@/components/review-desk/create-framework-assessment-button.client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type FrameworkSummary = {
  id: number;
  slug: string;
  name: string;
  version: string | null;
  status: string;
  controlCount: number;
  questionCount: number;
  assessmentCount: number;
  updatedAt: Date;
};

const nistFamilies = [
  ["AC", "Access Control"],
  ["AT", "Awareness and Training"],
  ["AU", "Audit and Accountability"],
  ["CA", "Assessment, Authorization, and Monitoring"],
  ["CM", "Configuration Management"],
  ["CP", "Contingency Planning"],
  ["IA", "Identification and Authentication"],
  ["IR", "Incident Response"],
  ["MA", "Maintenance"],
  ["MP", "Media Protection"],
  ["PE", "Physical and Environmental Protection"],
  ["PL", "Planning"],
  ["PM", "Program Management"],
  ["PS", "Personnel Security"],
  ["PT", "PII Processing and Transparency"],
  ["RA", "Risk Assessment"],
  ["SA", "System and Services Acquisition"],
  ["SC", "System and Communications Protection"],
  ["SI", "System and Information Integrity"],
  ["SR", "Supply Chain Risk Management"],
] as const;

const workflow = [
  ["01", "Send", "Questionnaire"],
  ["02", "Receive", "Submission"],
  ["03", "Score", "Findings"],
  ["04", "Remediate", "Attest"],
  ["05", "Release", "Record"],
] as const;

async function getFrameworks(): Promise<FrameworkSummary[]> {
  try {
    const frameworks = await prisma.truvernFramework.findMany({
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
      include: {
        _count: {
          select: {
            controls: true,
            assessments: true,
          },
        },
        controls: {
          select: {
            _count: {
              select: {
                questions: true,
              },
            },
          },
        },
      },
    });

    return frameworks.map((framework) => ({
      id: framework.id,
      slug: framework.slug,
      name: framework.name,
      version: framework.version,
      status: framework.status,
      controlCount: framework._count.controls,
      questionCount: framework.controls.reduce(
        (sum, control) => sum + control._count.questions,
        0,
      ),
      assessmentCount: framework._count.assessments,
      updatedAt: framework.updatedAt,
    }));
  } catch {
    return [];
  }
}

function statusTone(status: string) {
  if (status === "ACTIVE") {
    return "border-emerald-400/30 bg-emerald-400/10 text-emerald-200";
  }

  if (status === "ARCHIVED") {
    return "border-slate-400/30 bg-slate-400/10 text-slate-200";
  }

  return "border-amber-400/30 bg-amber-400/10 text-amber-200";
}

export default async function TruvernOpsLibraryPage() {
  const frameworks = await getFrameworks();

  const activeFrameworks =
    frameworks.filter((framework) => framework.status === "ACTIVE").length;

  const totalControls =
    frameworks.reduce(
      (sum, framework) => sum + framework.controlCount,
      0,
    );

  const totalQuestions =
    frameworks.reduce(
      (sum, framework) => sum + framework.questionCount,
      0,
    );

  const totalAssessments =
    frameworks.reduce(
      (sum, framework) => sum + framework.assessmentCount,
      0,
    );

  return (
    <main className="min-h-screen bg-[#020617] px-4 py-5 text-white sm:px-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-5">

        {/* Compact command header */}
        <section className="rounded-3xl border border-white/10 bg-white/[0.04] px-5 py-5">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200">
                Truvern Ops Library
              </div>

              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white md:text-3xl">
                Governance Assessment Library
              </h1>

              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
                Launch authoritative framework-backed reviews and manage the
                assessment lifecycle from one operator workspace.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Metric label="Frameworks" value={frameworks.length} />
              <Metric label="Active" value={activeFrameworks} />
              <Metric label="Controls" value={totalControls} />
              <Metric label="Questions" value={totalQuestions} />
              <Metric label="Assessments" value={totalAssessments} />
            </div>
          </div>
        </section>

        {/* Primary operational framework surface */}
        <section className="rounded-3xl border border-cyan-300/15 bg-cyan-300/[0.035] p-5">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">
                Assessment frameworks
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                Select a framework and begin a Truvern review.
              </p>
            </div>

            <Link
              href="/api/truvern/frameworks"
              className="text-sm font-semibold text-cyan-200 hover:text-cyan-100"
            >
              Framework API →
            </Link>
          </div>

          <div className="space-y-3">
            {frameworks.length > 0 ? (
              frameworks.map((framework) => (
                <article
                  key={framework.id}
                  className="rounded-2xl border border-white/10 bg-black/20 p-5"
                >
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-semibold text-white">
                          {framework.name}
                        </h3>

                        <span
                          className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusTone(
                            framework.status,
                          )}`}
                        >
                          {framework.status}
                        </span>
                      </div>

                      <div className="mt-1 text-xs text-slate-500">
                        {framework.slug}
                        {framework.version ? ` · ${framework.version}` : ""}
                      </div>

                      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
                        <Stat
                          value={framework.controlCount}
                          label="controls"
                        />
                        <Stat
                          value={framework.questionCount}
                          label="questions"
                        />
                        <Stat
                          value={nistFamilies.length}
                          label="families"
                        />
                        <Stat
                          value={framework.assessmentCount}
                          label="assessments"
                        />
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-col gap-2 lg:items-end">
                      <CreateFrameworkAssessmentButton
                        frameworkSlug={framework.slug}
                        frameworkName={framework.name}
                      />

                      <div className="text-xs text-slate-500">
                        Updated{" "}
                        {new Intl.DateTimeFormat("en", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        }).format(framework.updatedAt)}
                      </div>
                    </div>
                  </div>
                </article>
              ))
            ) : (
              <div className="rounded-2xl border border-white/10 bg-black/20 px-5 py-8 text-center text-sm text-slate-400">
                No framework records are currently available.
              </div>
            )}
          </div>
        </section>

        {/* Workflow at a glance */}
        <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">
                Review lifecycle
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                One continuous path from vendor questionnaire to governance release.
              </p>
            </div>

            <div className="text-xs text-slate-500">
              Truvern reviewer workflow
            </div>
          </div>

          <div className="mt-4 grid gap-2 md:grid-cols-5">
            {workflow.map(([index, title, detail], position) => (
              <div
                key={index}
                className="relative rounded-2xl border border-white/10 bg-black/20 px-4 py-3"
              >
                <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-300">
                  {index}
                </div>

                <div className="mt-1 text-sm font-semibold text-white">
                  {title}
                </div>

                <div className="text-xs text-slate-500">
                  {detail}
                </div>

                {position < workflow.length - 1 ? (
                  <div className="absolute -right-2 top-1/2 hidden -translate-y-1/2 text-slate-600 md:block">
                    →
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </section>

        {/* Dense family coverage */}
        <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">
                NIST SP 800-53 family coverage
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                All {nistFamilies.length} control families represented in the
                comprehensive assessment model.
              </p>
            </div>

            <div className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs font-semibold text-cyan-100">
              Full family model
            </div>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2 md:grid-cols-4 xl:grid-cols-5">
            {nistFamilies.map(([code, name]) => (
              <div
                key={code}
                className="flex min-h-[64px] items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-3 py-3"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-cyan-300/20 bg-cyan-300/10 text-xs font-bold text-cyan-100">
                  {code}
                </div>

                <div className="text-xs font-medium leading-4 text-slate-200">
                  {name}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Secondary operational detail */}
        <details className="group rounded-3xl border border-white/10 bg-white/[0.03]">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4">
            <div>
              <div className="text-sm font-semibold text-white">
                Framework operations & lifecycle details
              </div>
              <div className="mt-1 text-xs text-slate-500">
                API access, remediation, attestation and release integration
              </div>
            </div>

            <span className="text-sm text-cyan-200 group-open:rotate-180">
              ↓
            </span>
          </summary>

          <div className="border-t border-white/10 p-5">
            <div className="grid gap-3 md:grid-cols-3">
              <Signal
                title="Remediation"
                value="Open → Requested → Submitted → Accepted"
              />

              <Signal
                title="Attestation"
                value="Requested → Submitted → Accepted / Rejected"
              />

              <Signal
                title="Release integration"
                value={`${totalAssessments} framework assessment(s) tracked`}
              />
            </div>

            <div className="mt-4 flex justify-end">
              <Link
                href="/api/truvern/frameworks"
                className="rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-white/[0.05] hover:text-white"
              >
                Open framework API
              </Link>
            </div>
          </div>
        </details>
      </div>
    </main>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="min-w-[92px] rounded-2xl border border-white/10 bg-black/20 px-3 py-2.5">
      <div className="text-lg font-semibold text-white">{value}</div>
      <div className="mt-0.5 text-[10px] uppercase tracking-[0.18em] text-slate-500">
        {label}
      </div>
    </div>
  );
}

function Stat({
  value,
  label,
}: {
  value: number;
  label: string;
}) {
  return (
    <div>
      <span className="font-semibold text-white">{value}</span>{" "}
      <span className="text-slate-500">{label}</span>
    </div>
  );
}

function Signal({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">
        {title}
      </div>

      <div className="mt-2 text-sm font-semibold text-slate-100">
        {value}
      </div>
    </div>
  );
}

