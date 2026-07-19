import Link from "next/link";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const categories = [
  "Security",
  "Privacy",
  "Third-party risk",
  "Cloud",
  "AI vendor",
  "Business continuity",
  "Compliance",
  "Custom",
];

const standards = [
  "Truvern Custom",
  "SOC 2",
  "SIG Lite",
  "ISO 27001",
  "HIPAA",
  "PCI DSS",
  "AI Governance",
  "Internal Standard",
];

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

async function getDefaultOrganizationId() {
  const org = await prisma.organization.findFirst({
    orderBy: { id: "asc" },
    select: { id: true },
  });

  return org?.id ?? null;
}

async function createTemplate(formData: FormData) {
  "use server";

  const intent = String(formData.get("intent") || "publish");
  const name = String(formData.get("name") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const category = String(formData.get("category") || "").trim();
  const standard = String(formData.get("standard") || "").trim();
  const version = String(formData.get("version") || "1").trim() || "1";

  if (!name) {
    throw new Error("Template name is required.");
  }

  const organizationId = await getDefaultOrganizationId();
  const code = `${slugify(name) || "template"}-${Date.now()}`;

  const created = await prisma.assessmentTemplate.create({
    data: {
      organizationId,
      name,
      description: description || null,
      category: category || "Custom",
      standard: standard || "Truvern Custom",
      version,
      code,
      isActive: intent === "publish",
    },
    select: { id: true },
  });

  redirect(`/assessments/templates/${created.id}/builder`);
}

export default function NewAssessmentTemplatePage() {
  return (
    <main className="mx-auto max-w-7xl px-6 py-12 text-white">
      <section className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="inline-flex rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm text-cyan-200">
            Template Studio
          </div>

          <h1 className="mt-6 max-w-5xl text-5xl font-semibold tracking-tight md:text-6xl">
            Create a reusable assessment template.
          </h1>

          <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-300">
            Build an organization-owned assessment blueprint that can be reused
            across vendors and selected during vendor review launch.
          </p>
        </div>

        <Link
          href="/assessments/catalog"
          className="rounded-full border border-white/15 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
        >
          Back to catalog
        </Link>
      </section>

      <form action={createTemplate} className="mt-10 grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-8 shadow-2xl shadow-cyan-950/20">
          <p className="text-xs uppercase tracking-[0.3em] text-cyan-200">
            Template metadata
          </p>

          <div className="mt-6 grid gap-6 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-slate-200">
                Template name
              </label>
              <input
                name="name"
                required
                placeholder="Example: Critical SaaS Vendor Review"
                className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-4 text-white outline-none focus:border-cyan-400/40"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-200">
                Category
              </label>
              <select
                name="category"
                className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-4 text-white outline-none focus:border-cyan-400/40"
              >
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-200">
                Standard
              </label>
              <select
                name="standard"
                className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-4 text-white outline-none focus:border-cyan-400/40"
              >
                {standards.map((standard) => (
                  <option key={standard} value={standard}>
                    {standard}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-200">
                Version
              </label>
              <input
                name="version"
                defaultValue="1"
                className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-4 text-white outline-none focus:border-cyan-400/40"
              />
            </div>

            <div className="md:col-span-2">
              <label className="text-sm font-medium text-slate-200">
                Description
              </label>
              <textarea
                name="description"
                rows={6}
                placeholder="Describe when this template should be used, what risk domains it covers, and what governance outcome it supports."
                className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-4 text-white outline-none focus:border-cyan-400/40"
              />
            </div>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <button
              type="submit"
              name="intent"
              value="publish"
              className="rounded-full bg-cyan-300 px-7 py-4 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
            >
              Publish template
            </button>

            <button
              type="submit"
              name="intent"
              value="draft"
              className="rounded-full border border-white/15 px-7 py-4 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Save inactive draft
            </button>
          </div>
        </section>

        <section className="space-y-6">
          <div className="rounded-[2rem] border border-cyan-400/20 bg-white/[0.04] p-8">
            <p className="text-xs uppercase tracking-[0.3em] text-cyan-200">
              Builder roadmap
            </p>

            <h2 className="mt-4 text-2xl font-semibold text-white">
              Template builder launches immediately.
            </h2>

            <p className="mt-4 text-sm leading-7 text-slate-300">
              After creating the template, Truvern immediately opens the
              live governance builder where you can add sections, weighted
              questions, answer types, evidence guidance, scoring structure,
              and reusable governance workflows.
            </p>
          </div>

          <div className="rounded-[2rem] border border-amber-400/20 bg-amber-400/10 p-8">
            <p className="text-xs uppercase tracking-[0.3em] text-amber-100">
              Template lifecycle
            </p>

            <div className="mt-6 space-y-3">
              {["Draft", "Published", "Used for assessment", "Vendor submitted", "Governance Ops ready"].map((item, index) => (
                <div
                  key={item}
                  className="flex items-center gap-4 rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full border border-amber-300/30 bg-amber-300/10 text-sm font-semibold text-amber-100">
                    {index + 1}
                  </div>
                  <p className="text-sm font-semibold text-white">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </form>
    </main>
  );
}





