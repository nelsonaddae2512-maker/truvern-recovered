import { redirect } from "next/navigation";
import { requireDbOrganization } from "@/lib/org-db";
import {
  readCustomAssessmentCatalogTemplates,
  readSystemAssessmentCatalogTemplates,
} from "@/lib/repositories/assessment-catalog-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type TemplateRow = {
  id: number;
  name: string;
  description: string | null;
  standard: string | null;
  category: string | null;
  version: string | null;
  accessTier?: string | null;
  catalogKey?: string | null;
  isFeatured?: boolean | null;
  sectionCount?: number | null;
  questionCount?: number | null;
  isActive?: boolean | null;
  assessmentCount?: number | null;
  runCount?: number | null;
};

function accessTone(access?: string | null) {
  if (access === "ENTERPRISE") {
    return "border-violet-300/30 bg-violet-300/10 text-violet-100";
  }

  if (access === "PRO") {
    return "border-amber-300/30 bg-amber-300/10 text-amber-100";
  }

  return "border-cyan-300/30 bg-cyan-300/10 text-cyan-100";
}

function accessLabel(access?: string | null) {
  if (access === "ENTERPRISE") return "Enterprise";
  if (access === "PRO") return "Pro";
  return "Free";
}

export default async function AssessmentCatalogPage() {
  const org = await requireDbOrganization();

  if ("_needsOrgSelection" in org) {
    redirect("/dashboard");
  }

  const organizationId = org.id;

  const systemTemplates: TemplateRow[] =
    await readSystemAssessmentCatalogTemplates();

  const customTemplates: TemplateRow[] =
    await readCustomAssessmentCatalogTemplates(organizationId);

  return (
    <main className="mx-auto max-w-7xl px-6 py-12 text-white">
            <section className="mb-8 rounded-[2rem] border border-cyan-400/20 bg-cyan-500/10 p-6 shadow-2xl shadow-cyan-500/10">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-200">
              Truvern Reviews
            </div>

            <h2 className="mt-3 text-2xl font-black tracking-tight text-white">
              Choose how much of the review Truvern should operate.
            </h2>

            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
              Choose Self-Managed Review for internal ownership with no Truvern Review
              credit, Professional Review to launch the assessment yourself and
              route that same review to Truvern later for 1 credit, or Truvern
              Review for end-to-end questionnaire, evidence, findings, remediation,
              and release execution for 1 credit.
            </p>
          </div>

          <a
            href="/managed-assessments"
            className="inline-flex shrink-0 items-center justify-center rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
          >
            View Truvern Reviews
          </a>
        </div>
      </section>
<section className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="inline-flex rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm text-cyan-200">
            Assessment catalog
          </div>

          <h1 className="mt-6 max-w-5xl text-5xl font-semibold tracking-tight md:text-6xl">
            Choose the right vendor review path.
          </h1>

          <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-300">
            Use Truvern system catalog assessments or organization-created templates
            across all three commercial routes: keep the review Self-Managed,
            route the existing assessment to Truvern as a Professional Review,
            or engage Truvern from the start with Truvern Review.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <a
            href="/assessments/templates/new"
            className="inline-flex items-center justify-center rounded-2xl bg-cyan-300 px-6 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-200"
          >
            Create custom template
          </a>

          <a
            href="#custom-templates"
            className="inline-flex items-center justify-center rounded-2xl border border-white/15 bg-white/[0.04] px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            Manage custom templates
          </a>
        </div>
      </section>

      <section className="mt-12">
        <p className="text-xs uppercase tracking-[0.3em] text-cyan-200">
          Truvern system catalog
        </p>

        <h2 className="mt-3 text-3xl font-semibold">
          Membership-aware assessment options
        </h2>

        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          {systemTemplates.map((item) => (
            <article
              key={item.id}
              className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-7 shadow-2xl shadow-cyan-950/10"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.25em] text-slate-500">
                    {item.standard || "TRUVERN"}
                  </p>

                  <h3 className="mt-3 text-2xl font-semibold text-white">
                    {item.name}
                  </h3>
                </div>

                <span
                  className={`rounded-full border px-4 py-2 text-sm ${accessTone(
                    item.accessTier,
                  )}`}
                >
                  {accessLabel(item.accessTier)}
                </span>
              </div>

              <p className="mt-5 leading-8 text-slate-300">
                {item.description ||
                  "System-governed Truvern assessment template."}
              </p>

              <div className="mt-6 flex flex-wrap gap-2">
                <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-slate-200">
                  {item.sectionCount ?? 0} sections
                </span>

                <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-slate-200">
                  {item.questionCount ?? 0} questions
                </span>

                <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-slate-200">
                  Governance Ops compatible
                </span>

                {item.isFeatured ? (
                  <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs text-cyan-100">
                    Featured
                  </span>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section
        id="custom-templates"
        className="mt-14 scroll-mt-28 rounded-[2rem] border border-white/10 bg-white/[0.04] p-7"
      >
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-cyan-200">
              Organization templates
            </p>

            <h2 className="mt-3 text-3xl font-semibold">
              Custom assessment templates
            </h2>

            <p className="mt-4 max-w-3xl leading-8 text-slate-300">
              Create, reopen, publish, archive, and manage your organization's
              reusable vendor questionnaires from one place.
            </p>
          </div>

          <a
            href="/assessments/templates/new"
            className="inline-flex shrink-0 items-center justify-center rounded-2xl bg-cyan-300 px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-200"
          >
            Create custom template
          </a>
        </div>

        {customTemplates.length === 0 ? (
          <div className="mt-8 rounded-3xl border border-white/10 bg-slate-950/40 p-6">
            <h3 className="text-xl font-semibold">No custom templates yet</h3>
            <p className="mt-3 max-w-2xl text-slate-300">
              Create your first custom vendor questionnaire, or start with the
              Truvern catalog and customize as your program matures.
            </p>

            <a
              href="/assessments/templates/new"
              className="mt-5 inline-flex items-center justify-center rounded-2xl bg-cyan-300 px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-200"
            >
              Create custom template
            </a>
          </div>
        ) : (
          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            {customTemplates.map((template) => {
              const usageCount =
                (template.assessmentCount ?? 0) +
                (template.runCount ?? 0);

              const unused =
                usageCount === 0;

              return (
                <article
                  key={template.id}
                  className="rounded-3xl border border-white/10 bg-slate-950/40 p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <h3 className="text-xl font-semibold text-white">
                        {template.name}
                      </h3>

                      <p className="mt-2 text-sm text-slate-400">
                        {template.standard || "Custom"} ·{" "}
                        {template.category || "General"} · v
                        {template.version || "1"}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs text-cyan-100">
                        Custom
                      </span>

                      <span
                        className={
                          template.isActive
                            ? "rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-xs text-emerald-100"
                            : "rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-xs text-amber-100"
                        }
                      >
                        {template.isActive
                          ? "Published"
                          : "Inactive / Draft"}
                      </span>
                    </div>
                  </div>

                  <p className="mt-4 text-sm leading-7 text-slate-300">
                    {template.description ||
                      "Organization-created reusable assessment template."}
                  </p>

                  <div className="mt-5 flex flex-wrap gap-2 text-xs text-slate-300">
                    <span className="rounded-full border border-white/10 px-3 py-1">
                      {template.sectionCount ?? 0} sections
                    </span>

                    <span className="rounded-full border border-white/10 px-3 py-1">
                      {template.questionCount ?? 0} questions
                    </span>

                    <span
                      className={
                        unused
                          ? "rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-emerald-100"
                          : "rounded-full border border-violet-300/20 bg-violet-300/10 px-3 py-1 text-violet-100"
                      }
                    >
                      {unused
                        ? "Unused · permanent delete available"
                        : `${usageCount} historical use${usageCount === 1 ? "" : "s"} · retention required`}
                    </span>
                  </div>

                  <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-white/10 pt-5">
                    <a
                      href={`/assessments/templates/${template.id}/builder`}
                      className="inline-flex items-center justify-center rounded-2xl bg-cyan-300 px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-200"
                    >
                      Manage template
                    </a>

                    <span className="text-xs leading-5 text-slate-400">
                      {unused
                        ? "Open Template Studio to edit, publish/archive, or permanently delete."
                        : "Open Template Studio to edit lifecycle settings. Historical deletion is disabled."}
                    </span>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
