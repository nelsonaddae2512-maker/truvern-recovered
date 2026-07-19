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
  ["AC", "Access Control", "Identity, authorization, least privilege, session controls"],
  ["AT", "Awareness and Training", "Security training, role-based awareness, policy education"],
  ["AU", "Audit and Accountability", "Audit logs, monitoring, retention, accountability"],
  ["CA", "Assessment, Authorization, and Monitoring", "Control assessments, continuous monitoring, authorization"],
  ["CM", "Configuration Management", "Secure configuration, change control, baselines"],
  ["CP", "Contingency Planning", "Backup, disaster recovery, continuity planning"],
  ["IA", "Identification and Authentication", "Authentication, MFA, identity proofing"],
  ["IR", "Incident Response", "Incident handling, reporting, response testing"],
  ["MA", "Maintenance", "System maintenance controls and secure service procedures"],
  ["MP", "Media Protection", "Media access, storage, sanitization, transport"],
  ["PE", "Physical and Environmental Protection", "Facility access and environmental safeguards"],
  ["PL", "Planning", "Security planning, architecture, risk documentation"],
  ["PM", "Program Management", "Governance program, enterprise risk, oversight"],
  ["PS", "Personnel Security", "Screening, termination, transfer, sanctions"],
  ["PT", "PII Processing and Transparency", "Privacy notice, consent, processing authority"],
  ["RA", "Risk Assessment", "Risk identification, vulnerability monitoring, supply chain risk"],
  ["SA", "System and Services Acquisition", "Secure development, vendor acquisition, SDLC"],
  ["SC", "System and Communications Protection", "Network security, encryption, boundary protection"],
  ["SI", "System and Information Integrity", "Flaw remediation, monitoring, malicious code protection"],
  ["SR", "Supply Chain Risk Management", "Supplier controls, provenance, third-party governance"],
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
      questionCount: framework.controls.reduce((sum, control) => sum + control._count.questions, 0),
      assessmentCount: framework._count.assessments,
      updatedAt: framework.updatedAt,
    }));
  } catch {
    return [];
  }
}

function statusTone(status: string) {
  if (status === "ACTIVE") return "border-emerald-400/30 bg-emerald-400/10 text-emerald-200";
  if (status === "ARCHIVED") return "border-slate-400/30 bg-slate-400/10 text-slate-200";
  return "border-amber-400/30 bg-amber-400/10 text-amber-200";
}

export default async function TruvernOpsLibraryPage() {
  const frameworks = await getFrameworks();
  const activeFrameworks = frameworks.filter((framework) => framework.status === "ACTIVE").length;
  const totalControls = frameworks.reduce((sum, framework) => sum + framework.controlCount, 0);
  const totalQuestions = frameworks.reduce((sum, framework) => sum + framework.questionCount, 0);
  const totalAssessments = frameworks.reduce((sum, framework) => sum + framework.assessmentCount, 0);

  return (
    <main className="min-h-screen bg-[#020617] px-6 py-8 text-white">
      <div className="mx-auto flex max-w-7xl flex-col gap-8">
        <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.04] p-8 shadow-2xl shadow-cyan-950/30">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <div className="mb-4 inline-flex rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200">
                Truvern Ops Library
              </div>
              <h1 className="text-3xl font-semibold tracking-tight text-white md:text-5xl">
                Governance assessment control plane
              </h1>
              <p className="mt-4 text-base leading-7 text-slate-300 md:text-lg">
                Manage framework libraries, NIST 800-53 control coverage, reviewer scoring, automated findings,
                remediation requests, attestations, and release readiness from one Truvern-only operations surface.
              </p>
            </div>

            <div className="grid min-w-full grid-cols-2 gap-3 sm:min-w-[420px]">
              <Metric label="Frameworks" value={frameworks.length} />
              <Metric label="Active" value={activeFrameworks} />
              <Metric label="Controls" value={totalControls} />
              <Metric label="Questions" value={totalQuestions} />
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-4">
          <Capability title="Send to vendors" body="Launch framework-backed questionnaires and evidence requests." />
          <Capability title="Score automatically" body="Calculate control, family, and assessment risk posture." />
          <Capability title="Generate findings" body="Create reviewer-ready remediation and evidence gaps." />
          <Capability title="Request attestations" body="Trigger vendor certifications and formal sign-off where required." />
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-white">Framework library</h2>
                <p className="mt-1 text-sm text-slate-400">
                  Authoritative assessment frameworks available to Truvern reviewers.
                </p>
              </div>
              <Link
                href="/api/truvern/frameworks"
                className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-sm font-semibold text-cyan-100 hover:bg-cyan-300/15"
              >
                View API
              </Link>
            </div>

            <div className="mt-6 overflow-hidden rounded-3xl border border-white/10">
              <table className="w-full min-w-[760px] border-collapse text-left text-sm">
                <thead className="bg-white/[0.04] text-xs uppercase tracking-[0.2em] text-slate-400">
                  <tr>
                    <th className="px-5 py-4">Framework</th>
                    <th className="px-5 py-4">Status</th>
                    <th className="px-5 py-4">Controls</th>
                    <th className="px-5 py-4">Questions</th>
                    <th className="px-5 py-4">Assessments</th>
                    <th className="px-5 py-4">Updated</th>
                    <th className="px-5 py-4">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {frameworks.length > 0 ? (
                    frameworks.map((framework) => (
                      <tr key={framework.id} className="hover:bg-white/[0.03]">
                        <td className="px-5 py-4">
                          <div className="font-semibold text-white">{framework.name}</div>
                          <div className="mt-1 text-xs text-slate-500">
                            {framework.slug}
                            {framework.version ? ` · ${framework.version}` : ""}
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusTone(framework.status)}`}>
                            {framework.status}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-slate-200">{framework.controlCount}</td>
                        <td className="px-5 py-4 text-slate-200">{framework.questionCount}</td>
                        <td className="px-5 py-4 text-slate-200">{framework.assessmentCount}</td>
                        <td className="px-5 py-4 text-slate-400">
                          {new Intl.DateTimeFormat("en", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          }).format(framework.updatedAt)}
                        </td>
                        <td className="px-5 py-4">
                          <CreateFrameworkAssessmentButton
                            frameworkSlug={framework.slug}
                            frameworkName={framework.name}
                          />
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="px-5 py-10 text-center text-slate-400">
                        No framework records yet. The NIST 800-53 operating model is ready; seed data can be added through the framework APIs next.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-[2rem] border border-cyan-300/15 bg-cyan-300/[0.06] p-6">
            <h2 className="text-xl font-semibold text-white">Reviewer workflow</h2>
            <div className="mt-5 space-y-4">
              <WorkflowStep index="01" title="Send questionnaire" body="Truvern sends framework-scoped controls and evidence prompts to the vendor." />
              <WorkflowStep index="02" title="Receive submission" body="Vendor responses are normalized into assessment responses and reviewer queues." />
              <WorkflowStep index="03" title="Score and find gaps" body="Scoring and findings engines calculate risk, remediation, and attestation needs." />
              <WorkflowStep index="04" title="Push remediation" body="Reviewer sends findings back to vendor when evidence, correction, or certification is needed." />
              <WorkflowStep index="05" title="Release record" body="Completed assessment flows into immutable governance release infrastructure." />
            </div>
          </div>
        </section>

        <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6">
          <div className="flex flex-col gap-2">
            <h2 className="text-xl font-semibold text-white">NIST 800-53 control model</h2>
            <p className="text-sm text-slate-400">
              Truvern’s initial comprehensive framework coverage is organized around the full NIST SP 800-53 control family model.
            </p>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {nistFamilies.map(([code, name, description]) => (
              <div key={code} className="rounded-3xl border border-white/10 bg-black/20 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-sm font-bold text-cyan-100">
                    {code}
                  </div>
                  <span className="rounded-full border border-white/10 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-slate-500">
                    NIST
                  </span>
                </div>
                <h3 className="mt-4 text-sm font-semibold text-white">{name}</h3>
                <p className="mt-2 text-xs leading-5 text-slate-400">{description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <Signal title="Remediation lifecycle" value="Open → Requested → Submitted → Accepted" />
          <Signal title="Attestation workflow" value="Requested → Submitted → Accepted / Rejected" />
          <Signal title="Release integration" value={`${totalAssessments} framework assessment(s) tracked`} />
        </section>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
      <div className="text-2xl font-semibold text-white">{value}</div>
      <div className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-500">{label}</div>
    </div>
  );
}

function Capability({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
      <h3 className="font-semibold text-white">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-400">{body}</p>
    </div>
  );
}

function WorkflowStep({ index, title, body }: { index: string; title: string; body: string }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
      <div className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200">{index}</div>
      <h3 className="mt-2 font-semibold text-white">{title}</h3>
      <p className="mt-1 text-sm leading-6 text-slate-400">{body}</p>
    </div>
  );
}

function Signal({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
      <div className="text-xs uppercase tracking-[0.24em] text-slate-500">{title}</div>
      <div className="mt-3 text-sm font-semibold text-slate-100">{value}</div>
    </div>
  );
}



