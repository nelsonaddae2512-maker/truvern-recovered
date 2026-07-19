import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = {
  params: Promise<{ id: string }> | { id: string };
};

const questionTypes = ["TEXT", "YES_NO", "NUMBER", "MULTIPLE_CHOICE", "FILE_UPLOAD"];

function parseId(value: unknown) {
  const n = Number(String(value ?? "").trim());
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

function clean(value: unknown) {
  return String(value ?? "").trim();
}

async function addSection(formData: FormData) {
  "use server";

  const templateId = parseId(formData.get("templateId"));
  if (!templateId) throw new Error("Invalid template id.");

  const title = clean(formData.get("title"));
  const description = clean(formData.get("description"));
  const weight = Number(clean(formData.get("weight")));

  if (!title) throw new Error("Section title is required.");

  const existing = await prisma.assessmentSection.count({ where: { templateId } });

  await prisma.assessmentSection.create({
    data: {
      templateId,
      title,
      description: description || null,
      order: existing + 1,
      weight: Number.isFinite(weight) ? weight : null,
    },
    select: { id: true },
  });

  redirect(`/assessments/templates/${templateId}/builder`);
}

async function addQuestion(formData: FormData) {
  "use server";

  const templateId = parseId(formData.get("templateId"));
  const sectionId = parseId(formData.get("sectionId"));

  if (!templateId) throw new Error("Invalid template id.");
  if (!sectionId) throw new Error("Choose a section first.");

  const text = clean(formData.get("text"));
  const helpText = clean(formData.get("helpText"));
  const type = clean(formData.get("type")) || "TEXT";
  const required = clean(formData.get("required")) === "on";
  const weight = Number(clean(formData.get("weight")));

  const options = clean(formData.get("options"))
    .split("\n")
    .map((v) => v.trim())
    .filter(Boolean);

  if (!text) throw new Error("Question text is required.");

  const existing = await prisma.assessmentQuestion.count({
    where: { templateId, sectionId },
  });

  await prisma.assessmentQuestion.create({
    data: {
      templateId,
      sectionId,
      text,
      helpText: helpText || null,
      type: type as any,
      richType:
        type === "YES_NO"
          ? "YES_NO"
          : type === "NUMBER"
            ? "NUMBER"
            : type === "MULTIPLE_CHOICE"
              ? "MULTI_SELECT"
              : "TEXT",
      required,
      options: options.length ? { options } : undefined,
      weight: Number.isFinite(weight) ? weight : null,
      orderIndex: existing + 1,
    },
    select: { id: true },
  });

  redirect(`/assessments/templates/${templateId}/builder`);
}

async function bulkImportQuestions(formData: FormData) {
  "use server";

  const templateId = parseId(formData.get("templateId"));
  if (!templateId) throw new Error("Invalid template id.");

  const raw = clean(formData.get("bulkText"));
  const defaultType = clean(formData.get("bulkType")) || "YES_NO";

  if (!raw) {
    redirect(`/assessments/templates/${templateId}/builder`);
  }

  let currentSectionId: number | null = null;
  let sectionOrder = await prisma.assessmentSection.count({ where: { templateId } });

  const lines = raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    const sectionMatch = line.match(/^\[(.+)\]$/);

    if (sectionMatch) {
      sectionOrder += 1;

      const section = await prisma.assessmentSection.create({
        data: {
          templateId,
          title: sectionMatch[1].trim(),
          description: null,
          order: sectionOrder,
          weight: null,
        },
        select: { id: true },
      });

      currentSectionId = section.id;
      continue;
    }

    if (!currentSectionId) {
      sectionOrder += 1;

      const section = await prisma.assessmentSection.create({
        data: {
          templateId,
          title: "Imported questions",
          description: "Questions imported through bulk upload.",
          order: sectionOrder,
          weight: null,
        },
        select: { id: true },
      });

      currentSectionId = section.id;
    }

    const questionText = line.replace(/^[-*]\s*/, "").trim();
    if (!questionText) continue;

    const existing = await prisma.assessmentQuestion.count({
      where: { templateId, sectionId: currentSectionId },
    });

    await prisma.assessmentQuestion.create({
      data: {
        templateId,
        sectionId: currentSectionId,
        text: questionText,
        helpText: null,
        type: defaultType as any,
        richType: defaultType === "YES_NO" ? "YES_NO" : "TEXT",
        required: true,
        weight: null,
        orderIndex: existing + 1,
      },
      select: { id: true },
    });
  }

  redirect(`/assessments/templates/${templateId}/builder`);
}

export default async function TemplateBuilderPage({ params }: Props) {
  const resolvedParams = await params;
  const templateId = parseId(resolvedParams.id);

  if (!templateId) return notFound();

  const template = await prisma.assessmentTemplate.findUnique({
    where: { id: templateId },
    select: {
      id: true,
      name: true,
      description: true,
      category: true,
      standard: true,
      version: true,
      isActive: true,
      sections: {
        orderBy: [{ order: "asc" }, { id: "asc" }],
        select: {
          id: true,
          title: true,
          description: true,
          order: true,
          weight: true,
          questions: {
            orderBy: [{ orderIndex: "asc" }, { id: "asc" }],
            select: {
              id: true,
              text: true,
              helpText: true,
              type: true,
              required: true,
              weight: true,
              orderIndex: true,
              options: true,
            },
          },
        },
      },
    },
  });

  if (!template) return notFound();

  const sectionCount = template.sections.length;
  const questionCount = template.sections.reduce(
    (sum, section) => sum + section.questions.length,
    0,
  );

  return (
    <main className="mx-auto max-w-7xl px-6 py-10 text-white">
      <section className="rounded-[2.5rem] border border-cyan-400/20 bg-gradient-to-br from-cyan-950/40 via-slate-950 to-violet-950/20 p-8 shadow-2xl shadow-cyan-950/30">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.35em] text-cyan-200">
              Template Studio
            </div>

            <h1 className="mt-6 max-w-5xl text-5xl font-semibold tracking-tight">
              {template.name}
            </h1>

            <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-300">
              Build reusable governance questionnaires with sections, weighted questions,
              answer types, evidence guidance, and launch-ready vendor workflows.
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <Stat label="Sections" value={sectionCount} />
              <Stat label="Questions" value={questionCount} />
              <Stat label="Status" value={template.isActive ? "Published" : "Draft"} />
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link href="/assessments/catalog" className="rounded-full border border-white/15 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10">
              Catalog
            </Link>

            <Link href="/vendors" className="rounded-full bg-cyan-300 px-6 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-200">
              Use with vendor
            </Link>
          </div>
        </div>
      </section>

      <section className="mt-8 grid gap-8 lg:grid-cols-[0.82fr_1.18fr]">
        <div className="space-y-6">
          <Panel title="Add section" eyebrow="Structure">
            <form action={addSection}>
              <input type="hidden" name="templateId" value={template.id} />

              <Field label="Section title">
                <input name="title" required placeholder="Security governance" className="min-h-14 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-4 text-base text-white outline-none placeholder:text-slate-500 focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/10" />
              </Field>

              <Field label="Description">
                <textarea name="description" rows={6} placeholder="Describe what this section evaluates." className="min-h-14 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-4 text-base text-white outline-none placeholder:text-slate-500 focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/10" />
              </Field>

              <Field label="Weight">
                <input name="weight" type="number" placeholder="25" className="min-h-14 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-4 text-base text-white outline-none placeholder:text-slate-500 focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/10" />
              </Field>

              <button className="mt-5 w-full rounded-2xl bg-cyan-300 px-6 py-4 text-sm font-bold text-slate-950 transition hover:bg-cyan-200">
                Add section
              </button>
            </form>
          </Panel>

          <Panel title="Add question" eyebrow="Manual question">
            <form action={addQuestion}>
              <input type="hidden" name="templateId" value={template.id} />

              <Field label="Section">
                <select name="sectionId" required className="min-h-14 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-4 text-base text-white outline-none placeholder:text-slate-500 focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/10">
                  <option value="">Choose section</option>
                  {template.sections.map((section) => (
                    <option key={section.id} value={section.id}>
                      {section.title}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Question">
                <textarea name="text" required rows={6} placeholder="Does the vendor maintain a documented incident response plan?" className="min-h-14 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-4 text-base text-white outline-none placeholder:text-slate-500 focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/10" />
              </Field>

              <Field label="Help text">
                <input name="helpText" placeholder="Ask for policy evidence or a summary." className="min-h-14 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-4 text-base text-white outline-none placeholder:text-slate-500 focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/10" />
              </Field>

              <Field label="Answer options">
                <textarea name="options" rows={6} placeholder={"Yes\nNo\nPartially implemented"} className="min-h-14 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-4 text-base text-white outline-none placeholder:text-slate-500 focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/10" />
              </Field>

              <div className="grid gap-4 md:grid-cols-3">
                <Field label="Type">
                  <select name="type" className="min-h-14 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-4 text-base text-white outline-none placeholder:text-slate-500 focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/10">
                    {questionTypes.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Weight">
                  <input name="weight" type="number" placeholder="5" className="min-h-14 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-4 text-base text-white outline-none placeholder:text-slate-500 focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/10" />
                </Field>

                <label className="mt-8 flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-4 text-sm text-slate-200">
                  <input type="checkbox" name="required" className="h-4 w-4 accent-cyan-300" />
                  Required
                </label>
              </div>

              <button disabled={template.sections.length === 0} className="mt-5 w-full rounded-2xl bg-cyan-300 px-6 py-4 text-base font-bold text-slate-950 shadow-xl shadow-cyan-950/30 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-300 disabled:opacity-70">
                Add question
              </button>
            </form>
          </Panel>

          <Panel title="Bulk import questions" eyebrow="Fast upload">
            <form action={bulkImportQuestions}>
              <input type="hidden" name="templateId" value={template.id} />

              <Field label="Default answer type">
                <select name="bulkType" defaultValue="YES_NO" className="min-h-14 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-4 text-base text-white outline-none placeholder:text-slate-500 focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/10">
                  {questionTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Paste questions">
                <textarea
                  name="bulkText"
                  required
                  rows={14}
                  placeholder={"[Access governance]\n- Does your organization require MFA?\n- Do you review user access quarterly?\n\n[Incident readiness]\n- Do you maintain an incident response plan?\n- Do you test the plan annually?"}
                  className="min-h-14 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-4 text-base text-white outline-none placeholder:text-slate-500 focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/10"
                />
              </Field>

              <p className="mt-3 text-xs leading-6 text-slate-400">
                Use [Section name] lines to create sections. Each bullet or line beneath it becomes a question.
              </p>

              <button className="mt-5 w-full rounded-2xl bg-violet-300 px-6 py-4 text-sm font-bold text-slate-950 transition hover:bg-violet-200">
                Import questions
              </button>
            </form>
          </Panel>
        </div>

        <section className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto rounded-[2rem] border border-white/10 bg-white/[0.04] p-7 shadow-2xl shadow-black/30">
          <p className="text-xs uppercase tracking-[0.3em] text-cyan-200">
            Live template preview
          </p>

          {template.sections.length === 0 ? (
            <div className="mt-6 rounded-3xl border border-dashed border-white/10 bg-slate-950/50 p-8">
              <h2 className="text-2xl font-semibold">No sections yet</h2>
              <p className="mt-3 leading-7 text-slate-300">
                Add the first governance section or use bulk import to build the assessment quickly.
              </p>
            </div>
          ) : (
            <div className="mt-6 space-y-5">
              {template.sections.map((section) => (
                <article key={section.id} className="rounded-3xl border border-white/10 bg-slate-950/50 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.25em] text-slate-500">
                        Section {section.order}
                      </p>

                      <h2 className="mt-2 text-2xl font-semibold text-white">
                        {section.title}
                      </h2>

                      {section.description ? (
                        <p className="mt-3 leading-7 text-slate-300">
                          {section.description}
                        </p>
                      ) : null}
                    </div>

                    <span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-xs text-amber-100">
                      Weight {section.weight ?? "-"}
                    </span>
                  </div>

                  <div className="mt-5 space-y-3">
                    {section.questions.length === 0 ? (
                      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-400">
                        No questions in this section yet.
                      </div>
                    ) : (
                      section.questions.map((question) => {
                        const options = Array.isArray((question.options as any)?.options)
                          ? ((question.options as any).options as string[])
                          : [];

                        return (
                          <div key={question.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                            <div className="flex flex-wrap items-start justify-between gap-4">
                              <p className="max-w-2xl text-sm font-semibold leading-7 text-white">
                                {question.text}
                              </p>

                              <div className="flex flex-wrap gap-2">
                                <Badge>{String(question.type)}</Badge>
                                {question.required ? <Badge>Required</Badge> : null}
                              </div>
                            </div>

                            {options.length ? (
                              <div className="mt-4 flex flex-wrap gap-2">
                                {options.map((option) => (
                                  <Badge key={option}>{option}</Badge>
                                ))}
                              </div>
                            ) : null}

                            {question.helpText ? (
                              <p className="mt-3 text-sm leading-7 text-slate-400">
                                {question.helpText}
                              </p>
                            ) : null}
                          </div>
                        );
                      })
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}

function Panel({
  title,
  eyebrow,
  children,
}: {
  title: string;
  eyebrow: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-7 shadow-2xl shadow-black/20">
      <p className="text-xs uppercase tracking-[0.3em] text-cyan-200">{eyebrow}</p>
      <h2 className="mt-3 text-2xl font-semibold text-white">{title}</h2>
      <div className="mt-6 space-y-5">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="text-sm font-semibold text-slate-200">{label}</label>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs text-cyan-100">
      {children}
    </span>
  );
}

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/50 px-5 py-4">
      <p className="text-xs uppercase tracking-[0.25em] text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
    </div>
  );
}




