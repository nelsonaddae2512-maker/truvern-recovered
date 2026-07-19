"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type MembershipTier =
  | "FREE"
  | "PRO"
  | "ENTERPRISE"
  | "TRIAL"
  | "DEMO"
  | "PROMOTIONAL"
  | "BUSINESS"
  | "GROWTH"
  | "SCALE";

type TemplateChoice = {
  id: number;
  name: string;
  description: string | null;
  standard: string | null;
  category: string | null;
  version: string | null;
  sectionCount?: number | null;
  questionCount?: number | null;
  status?: string | null;
  accessTier?: string | null;
  source?: string | null;
  origin?: string | null;
  isSystem?: boolean | null;
  isFeatured?: boolean | null;
  sections?: {
    id: number;
    title: string;
    description?: string | null;
    questions?: {
      id: number;
      text: string;
      type?: string | null;
      required?: boolean | null;
    }[];
  }[];
};

type Props = {
  vendorId: number;
  vendorName: string;
  templates: TemplateChoice[];
  membershipTier: MembershipTier;
};

function cleanText(value: string | null | undefined, fallback = "") {
  if (!value) return fallback;

  return value
    .replace(/\uFEFF/g, "")
    .replace(/ï»¿/g, "")
    .replace(/`r`n/g, "")
    .replace(/\\r\\n/g, "")
    .replace(/\\r/g, "")
    .replace(/\\n/g, "")
    .trim();
}

function tierLabel(tier?: string | null, source?: string | null) {
  if (source === "CUSTOM") return "Custom";
  if (tier === "ENTERPRISE") return "Enterprise";
  if (tier === "PRO") return "Pro";
  if (tier === "FREE") return "Free";
  return source === "SYSTEM" ? "Catalog" : "Custom";
}

function tierTone(tier?: string | null, source?: string | null) {
  if (source === "CUSTOM") {
    return "border-fuchsia-500/30 bg-fuchsia-950/30 text-fuchsia-200";
  }

  if (tier === "ENTERPRISE") {
    return "border-violet-500/30 bg-violet-950/30 text-violet-200";
  }

  if (tier === "PRO") {
    return "border-amber-500/30 bg-amber-950/30 text-amber-200";
  }

  return "border-cyan-500/30 bg-cyan-950/30 text-cyan-200";
}

function isTruvernFramework(template: TemplateChoice) {
  const standard = (template.standard || "").toUpperCase();
  const source = (template.source || "").toUpperCase();
  const origin = (template.origin || "").toUpperCase();
  const category = (template.category || "").toUpperCase();

  return (
    standard.includes("NIST") ||
    standard.includes("800-53") ||
    source === "SYSTEM" ||
    source === "TRUVERN" ||
    origin === "SYSTEM" ||
    origin === "TRUVERN" ||
    category.includes("GOVERNANCE")
  );
}

function canAccessTemplate(
  template: TemplateChoice,
  membershipTier: MembershipTier,
) {
  if (template.source === "CUSTOM") return true;

  if (isTruvernFramework(template)) {
    return true;
  }

  if (!template.accessTier) return true;

  const tier = membershipTier.toUpperCase();

  if (
    [
      "ENTERPRISE",
      "BUSINESS",
      "SCALE",
      "TRIAL",
      "DEMO",
      "PROMOTIONAL",
    ].includes(tier)
  ) {
    return true;
  }

  if (["PRO", "GROWTH"].includes(tier)) {
    return (
      template.accessTier === "FREE" ||
      template.accessTier === "PRO"
    );
  }

  return template.accessTier === "FREE";
}

export default function AssessmentStartChooser({
  vendorId,
  vendorName,
  templates,
  membershipTier,
}: Props) {
  const router = useRouter();

  const firstAvailableTemplate = useMemo(
    () => templates.find((template) => canAccessTemplate(template, membershipTier)) ?? templates[0] ?? null,
    [templates],
  );

  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(
    firstAvailableTemplate?.id ?? null,
  );

  const [title, setTitle] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedTemplate = useMemo(

    () => templates.find((template) => template.id === selectedTemplateId) ?? null,
    [templates, selectedTemplateId],
  );

  const selectedLocked = selectedTemplate
    ? !canAccessTemplate(selectedTemplate, membershipTier)
    : false;

  
  const freeBlockedTruvernNistLaunch =
    membershipTier === "FREE" &&
    selectedTemplate?.name === "Truvern NIST 800-53 Governance Review";
async function handleStart() {
    if (freeBlockedTruvernNistLaunch) {
      window.alert(
        "This assessment requires a Pro or Enterprise membership. Free users may preview the Truvern NIST 800-53 Governance Review but cannot launch it."
      );
      return;
    }

    // FREE_TRUVERN_NIST_LAUNCH_BLOCK
    const confirmed = window.confirm(
      "Confirm assessment launch?\n\nThis starts a Self-Managed or Professional Review assessment workflow. You can still request Truvern professional review after the vendor submits the questionnaire. For Truvern Review end-to-end, use the dedicated Truvern Review route.",
    );

    if (!confirmed) {
      return;
    }

    if (!selectedTemplateId) {
      setError("Select a template to start.");
      return;
    }

    const selected = templates.find((template) => template.id === selectedTemplateId);

    if (selected && !canAccessTemplate(selected, membershipTier)) {
      setError("Your membership tier does not allow this assessment template.");
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const res = await fetch(`/api/vendors/${vendorId}/assessments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          templateId: selectedTemplateId,
          title: title.trim() || undefined,
          dueAt: dueAt || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Failed to start assessment");
      }

      const data = await res.json();

      if (data.redirectUrl) {
        router.push(data.redirectUrl);
        return;
      }

      if (data.id) {
        router.push(`/assessments/${data.id}/launch`);
      }
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Failed to start assessment");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="glass-soft rounded-3xl px-5 py-5 shadow-lg shadow-black/40">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-950/40 px-3 py-1">
              <span className="h-2 w-2 rounded-full bg-cyan-400" />
              <span className="text-[10px] font-semibold uppercase tracking-[0.24em] text-cyan-200">
                Choose Governance Route
              </span>
            </div>

            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">
              Launch Self-Managed or Professional Review
            </h1>

            <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-300">
              Select a reusable assessment template, preview governance coverage,
              and launch a vendor review workflow for{" "}
              <span className="font-semibold text-cyan-200">
                {cleanText(vendorName)}
              </span>
              .
            </p>

            <div className="mt-4 rounded-2xl border border-cyan-500/20 bg-cyan-950/20 px-4 py-3 text-sm text-cyan-100">
              <div className="font-semibold">
                Truvern Expert Review Access
              </div>

              <div className="mt-1 text-cyan-200/90">
                Truvern Reviews unlock enterprise governance frameworks, expert-operated reviews, remediation guidance, governance releases, and board-defensible records.
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  href="/billing/credits"
                  className="inline-flex items-center rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-3 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-400/20"
                >
                  Purchase credits
                </Link>

                <Link
                  href="/billing/plans"
                  className="inline-flex items-center rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/10"
                >
                  Compare plans
                </Link>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link href={`/vendors/${vendorId}`} className="btn-glass text-sm">
              Back to vendor
            </Link>

            <Link href="/assessments/catalog" className="btn-glass text-sm">
              Assessment catalog
            </Link>

            <Link href="/assessments/templates/new" className="btn-primary text-sm">
              Create template
            </Link>
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-2xl border border-rose-500/40 bg-rose-950/30 px-4 py-3 text-sm text-rose-100">
            {error}
          </div>
        )}
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.3fr_0.9fr]">
        <div className="glass-soft rounded-3xl px-5 py-5 shadow-lg shadow-black/40">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                Assessment templates
              </p>

              <h2 className="mt-1 text-xl font-semibold text-white">
                Governance catalog
              </h2>
            </div>

            <div className="rounded-full border border-emerald-500/20 bg-emerald-950/30 px-3 py-1 text-[11px] text-emerald-200">
              {templates.length} templates
            </div>
          </div>

          {templates.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-700 bg-slate-950/50 px-5 py-10 text-center">
              <p className="text-lg font-medium text-slate-200">
                No templates available yet
              </p>

              <p className="mt-2 text-sm text-slate-500">
                Create reusable governance templates with sections, scoring,
                evidence requirements, and vendor questionnaires.
              </p>

              <Link href="/assessments/templates/new" className="btn-primary mt-5 inline-flex">
                Create first template
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {templates.map((template) => {
                const selected = selectedTemplateId === template.id;
                const locked = !canAccessTemplate(template, membershipTier);
                const sourceLabel =
                  template.source === "SYSTEM" ? "Truvern Catalog" : "Custom Template";

                return (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => {
                      if (locked) return;
                      setSelectedTemplateId(template.id);
                    }}
                    className={`w-full rounded-3xl border px-4 py-4 text-left transition ${
                      locked
                        ? "cursor-not-allowed border-white/5 bg-black/20 opacity-60"
                        : selected
                          ? "border-cyan-400/60 bg-slate-900 shadow-lg shadow-cyan-950/30"
                          : "border-slate-800 bg-slate-950/60 hover:border-cyan-500/40"
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="text-base font-semibold text-white">
                          {cleanText(template.name, "Untitled template")}
                        </h3>

                        {locked && (
                          <div className="mt-3 rounded-2xl border border-amber-500/30 bg-amber-950/20 px-3 py-3 text-xs text-amber-100">
                            <div className="font-semibold">
                              Membership upgrade required
                            </div>
                            <div className="mt-1 text-amber-200/90">
                              This framework requires {tierLabel(template.accessTier, template.source)}. Upgrade your Truvern service to launch it.
                            </div>
                          </div>
                        )}

                        {template.description && (
                          <p className="mt-2 line-clamp-2 text-sm text-slate-400">
                            {cleanText(template.description)}
                          </p>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <span className={`rounded-full border px-2 py-1 text-[10px] uppercase tracking-[0.18em] ${tierTone(template.accessTier, template.source)}`}>
                          {tierLabel(template.accessTier, template.source)}
                        </span>

                        <span
                          className={`rounded-full border px-2 py-1 text-[10px] uppercase tracking-[0.18em] ${
                            template.source === "SYSTEM"
                              ? "border-cyan-500/30 bg-cyan-950/20 text-cyan-100"
                              : "border-fuchsia-500/30 bg-fuchsia-950/20 text-fuchsia-100"
                          }`}
                        >
                          {sourceLabel}
                        </span>

                        {template.isFeatured && (
                          <span className="rounded-full border border-emerald-500/30 bg-emerald-950/20 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-emerald-100">
                            Featured
                          </span>
                        )}

                        {template.status && (
                          <span className="rounded-full border border-emerald-500/30 bg-emerald-950/30 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-emerald-200">
                            {cleanText(template.status)}
                          </span>
                        )}

                        {template.version && (
                          <span className="rounded-full border border-slate-700 bg-slate-900 px-2 py-1 text-[10px] text-slate-400">
                            v{cleanText(template.version)}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {template.standard && (
                        <span className="rounded-full border border-slate-700 bg-slate-900/80 px-2 py-1 text-[10px] text-slate-300">
                          {cleanText(template.standard)}
                        </span>
                      )}

                      {template.category && (
                        <span className="rounded-full border border-slate-700 bg-slate-900/80 px-2 py-1 text-[10px] text-slate-400">
                          {cleanText(template.category)}
                        </span>
                      )}

                      <span className="rounded-full border border-slate-700 bg-slate-900/80 px-2 py-1 text-[10px] text-slate-400">
                        {template.sectionCount ?? 0} sections
                      </span>

                      <span className="rounded-full border border-slate-700 bg-slate-900/80 px-2 py-1 text-[10px] text-slate-400">
                        {template.questionCount ?? 0} questions
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="glass-soft sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto rounded-3xl px-5 py-5 shadow-lg shadow-black/40">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
            Live governance preview
          </p>

          {selectedTemplate ? (
            <div className="mt-3 rounded-3xl border border-slate-800 bg-slate-950/60 p-5">
              <h2 className="text-2xl font-semibold text-white">
                {cleanText(selectedTemplate.name, "Untitled template")}
              </h2>

              {selectedTemplate.description && (
                <p className="mt-3 text-sm leading-7 text-slate-300">
                  {cleanText(selectedTemplate.description)}
                </p>
              )}

              {selectedLocked && (
                <div className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-950/20 px-4 py-3 text-sm text-amber-100">
                  This template requires {tierLabel(selectedTemplate.accessTier, selectedTemplate.source)}. Upgrade your Truvern service to launch it.
                  Upgrade your plan to launch this framework.
                </div>
              )}

              <div className="mt-5 grid grid-cols-2 gap-3">
                <MetricCard label="Sections" value={String(selectedTemplate.sectionCount ?? 0)} />
                <MetricCard label="Questions" value={String(selectedTemplate.questionCount ?? 0)} />
                <MetricCard label="Category" value={cleanText(selectedTemplate.category, "General")} />
                <MetricCard label="Standard" value={cleanText(selectedTemplate.standard, "Truvern")} />
              </div>

              <div className="mt-6 space-y-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-400">
                    Assessment title
                  </label>

                  <input
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    className="input-glass mt-1 text-sm"
                    placeholder="2026 Critical Vendor Governance Review"
                    disabled={selectedLocked}
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-400">
                    Due date
                  </label>

                  <input
                    type="date"
                    value={dueAt}
                    onChange={(event) => setDueAt(event.target.value)}
                    className="input-glass mt-1 text-sm"
                    disabled={selectedLocked}
                  />
                </div>
              </div>

              <div className="mt-6">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Preview questions
                  </p>

                  <p className="text-xs text-slate-500">
                    {(selectedTemplate.sections ?? []).length} sections
                  </p>
                </div>

                <div className="space-y-3">
                  {(selectedTemplate.sections ?? []).length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/40 px-4 py-5 text-sm text-slate-500">
                      This template has no previewable sections yet.
                    </div>
                  ) : (
                    selectedTemplate.sections?.map((section) => (
                      <div key={section.id} className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="text-sm font-semibold text-white">
                              {cleanText(section.title)}
                            </h3>

                            {section.description && (
                              <p className="mt-1 text-xs text-slate-400">
                                {cleanText(section.description)}
                              </p>
                            )}
                          </div>

                          <span className="rounded-full border border-slate-700 bg-slate-900 px-2 py-1 text-[10px] text-slate-400">
                            {(section.questions ?? []).length} questions
                          </span>
                        </div>

                        <div className="mt-4 space-y-2">
                          {(section.questions ?? []).map((question) => (
                            <div key={question.id} className="rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-3">
                              <div className="flex items-start justify-between gap-3">
                                <p className="text-sm text-slate-200">
                                  {cleanText(question.text)}
                                </p>

                                <div className="flex shrink-0 items-center gap-2">
                                  {question.required && (
                                    <span className="rounded-full border border-rose-500/30 bg-rose-950/30 px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-rose-200">
                                      Required
                                    </span>
                                  )}

                                  {question.type && (
                                    <span className="rounded-full border border-cyan-500/20 bg-cyan-950/30 px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-cyan-200">
                                      {cleanText(question.type)}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="sticky bottom-0 z-20 mt-6 border-t border-white/10 bg-[#020817]/95 py-4 backdrop-blur">
                {selectedLocked ? (
                  <Link href="/billing/plans" className="flex w-full items-center justify-center rounded-2xl bg-amber-300 px-6 py-4 text-base font-bold text-slate-950 shadow-xl shadow-amber-950/40 transition hover:bg-amber-200">
                    Upgrade plan
                  </Link>
                ) : (
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={handleStart}
                    className="flex w-full items-center justify-center rounded-2xl bg-cyan-300 px-6 py-4 text-base font-bold text-slate-950 shadow-xl shadow-cyan-950/40 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {submitting
  ? "Launching assessment..."
  : freeBlockedTruvernNistLaunch ? "Upgrade to Pro or Enterprise" : "Launch assessment workflow"}
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-3xl border border-dashed border-slate-700 bg-slate-950/50 px-4 py-10 text-center text-sm text-slate-500">
              Select a template to preview.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3">
      <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
        {label}
      </p>

      <p className="mt-1 text-lg font-semibold text-white">
        {value}
      </p>
    </div>
  );
}





















