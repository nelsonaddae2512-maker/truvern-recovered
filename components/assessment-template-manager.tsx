"use client";

import { useEffect, useMemo, useState } from "react";

type TemplateSummary = {
  id: number;
  name: string;
  description: string | null;
  standard: string | null;
  code: string | null;
  category: string | null;
  version: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  assessmentCount: number;
};

type QuestionKind = "YES_NO" | "TEXT" | "SELECT" | "MULTI_SELECT" | "NUMBER";

type UIQuestion = {
  id?: number;
  prompt: string;
  helpText?: string;
  kind: QuestionKind;
  required: boolean;
  weight?: number | null;
  key?: string;
  optionsText?: string; // comma-separated
  orderIndex: number;
};

type UISection = {
  id?: number;
  title: string;
  description?: string;
  order: number;
  weight?: number | null;
  questions: UIQuestion[];
};

type TemplateDetail = {
  id: number;
  name: string;
  description: string | null;
  standard: string | null;
  code: string | null;
  category: string | null;
  version: string | null;
  isActive: boolean;
  sections: UISection[];
};

type Props = {
  initialTemplates: TemplateSummary[];
};

export default function AssessmentTemplateManager({ initialTemplates }: Props) {
  const [templates, setTemplates] = useState<TemplateSummary[]>(initialTemplates);
  const [selectedId, setSelectedId] = useState<number | null>(
    initialTemplates[0]?.id ?? null
  );
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [savingMeta, setSavingMeta] = useState(false);
  const [savingStructure, setSavingStructure] = useState(false);
  const [detail, setDetail] = useState<TemplateDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const currentTemplate = useMemo(
    () => templates.find((t) => t.id === selectedId) ?? null,
    [templates, selectedId]
  );

  // Fetch detail when template changes
  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }

    let cancelled = false;
    async function loadDetail() {
      try {
        setError(null);
        setLoadingDetail(true);
        const res = await fetch(`/api/assessment-templates/${selectedId}`);
        if (!res.ok) {
          throw new Error(`Failed to load template ${selectedId}`);
        }
        const data = await res.json();

        if (cancelled) return;

        const sections: UISection[] = (data.sections || []).map(
          (section: any, sIndex: number) => ({
            id: section.id,
            title: section.title ?? `Section ${sIndex + 1}`,
            description: section.description ?? "",
            order: section.order ?? sIndex,
            weight: section.weight ?? null,
            questions: (section.questions || []).map(
              (q: any, qIndex: number): UIQuestion => {
                const kind: QuestionKind =
                  q.richType ??
                  (q.type === "BOOLEAN"
                    ? "YES_NO"
                    : q.type === "MULTI_CHOICE"
                    ? "SELECT"
                    : "TEXT");

                let optionsText = "";
                try {
                  const opts = (q.options as any)?.options;
                  if (Array.isArray(opts)) {
                    optionsText = opts.join(", ");
                  }
                } catch {
                  // ignore
                }

                return {
                  id: q.id,
                  prompt: q.text ?? "",
                  helpText: q.helpText ?? "",
                  kind,
                  required: q.required ?? false,
                  weight: q.weight ?? null,
                  key: q.key ?? "",
                  optionsText,
                  orderIndex: q.orderIndex ?? qIndex,
                };
              }
            ),
          })
        );

        setDetail({
          id: data.id,
          name: data.name,
          description: data.description,
          standard: data.standard,
          code: data.code,
          category: data.category,
          version: data.version,
          isActive: data.isActive,
          sections,
        });
      } catch (err: any) {
        console.error(err);
        if (!cancelled) {
          setError(err.message ?? "Failed to load template");
        }
      } finally {
        if (!cancelled) {
          setLoadingDetail(false);
        }
      }
    }

    loadDetail();

    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  async function handleCreateTemplate() {
    try {
      setError(null);
      const res = await fetch("/api/assessment-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "New assessment template",
          description: "",
        }),
      });
      if (!res.ok) {
        throw new Error("Failed to create template");
      }
      const data = await res.json();
      const newTemplate: TemplateSummary = {
        id: data.id,
        name: data.name,
        description: data.description ?? null,
        standard: data.standard ?? null,
        code: data.code ?? null,
        category: data.category ?? null,
        version: data.version ?? null,
        isActive: data.isActive ?? true,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        assessmentCount: 0,
      };
      setTemplates((prev) => [newTemplate, ...prev]);
      setSelectedId(newTemplate.id);
    } catch (err: any) {
      console.error(err);
      setError(err.message ?? "Failed to create template");
    }
  }

  function updateDetailMeta(patch: Partial<TemplateDetail>) {
    setDetail((prev) => (prev ? { ...prev, ...patch } : prev));
  }

  function updateSection(index: number, patch: Partial<UISection>) {
    setDetail((prev) => {
      if (!prev) return prev;
      const sections = [...prev.sections];
      sections[index] = { ...sections[index], ...patch };
      return { ...prev, sections };
    });
  }

  function addSection() {
    setDetail((prev) => {
      if (!prev) return prev;
      const order = prev.sections.length;
      const newSection: UISection = {
        title: `Section ${order + 1}`,
        description: "",
        order,
        weight: null,
        questions: [],
      };
      return { ...prev, sections: [...prev.sections, newSection] };
    });
  }

  function removeSection(index: number) {
    setDetail((prev) => {
      if (!prev) return prev;
      const sections = prev.sections.filter((_, i) => i !== index);
      return { ...prev, sections };
    });
  }

  function addQuestion(sectionIndex: number) {
    setDetail((prev) => {
      if (!prev) return prev;
      const sections = [...prev.sections];
      const section = sections[sectionIndex];
      const orderIndex = section.questions.length;
      const newQuestion: UIQuestion = {
        prompt: "",
        helpText: "",
        kind: "YES_NO",
        required: false,
        weight: null,
        key: "",
        optionsText: "",
        orderIndex,
      };
      sections[sectionIndex] = {
        ...section,
        questions: [...section.questions, newQuestion],
      };
      return { ...prev, sections };
    });
  }

  function updateQuestion(
    sectionIndex: number,
    questionIndex: number,
    patch: Partial<UIQuestion>
  ) {
    setDetail((prev) => {
      if (!prev) return prev;
      const sections = [...prev.sections];
      const section = sections[sectionIndex];
      const questions = [...section.questions];
      questions[questionIndex] = { ...questions[questionIndex], ...patch };
      sections[sectionIndex] = { ...section, questions };
      return { ...prev, sections };
    });
  }

  function removeQuestion(sectionIndex: number, questionIndex: number) {
    setDetail((prev) => {
      if (!prev) return prev;
      const sections = [...prev.sections];
      const section = sections[sectionIndex];
      const questions = section.questions.filter((_, i) => i !== questionIndex);
      sections[sectionIndex] = { ...section, questions };
      return { ...prev, sections };
    });
  }

  async function saveMeta() {
    if (!detail) return;
    try {
      setSavingMeta(true);
      setError(null);
      const res = await fetch(`/api/assessment-templates/${detail.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: detail.name,
          description: detail.description,
          standard: detail.standard,
          category: detail.category,
          version: detail.version,
          isActive: detail.isActive,
        }),
      });
      if (!res.ok) {
        throw new Error("Failed to save template details");
      }
      const data = await res.json();
      setTemplates((prev) =>
        prev.map((t) =>
          t.id === detail.id
            ? {
                ...t,
                name: data.name,
                description: data.description,
                standard: data.standard,
                category: data.category,
                version: data.version,
                isActive: data.isActive,
                updatedAt: data.updatedAt,
              }
            : t
        )
      );
    } catch (err: any) {
      console.error(err);
      setError(err.message ?? "Failed to save template details");
    } finally {
      setSavingMeta(false);
    }
  }

  async function saveStructure() {
    if (!detail) return;
    try {
      setSavingStructure(true);
      setError(null);

      const payload = {
        sections: detail.sections.map((section, sIndex) => ({
          id: section.id,
          title: section.title,
          description: section.description,
          order: sIndex,
          weight: section.weight,
          questions: section.questions.map((q, qIndex) => ({
            id: q.id,
            prompt: q.prompt,
            helpText: q.helpText,
            kind: q.kind,
            required: q.required,
            weight: q.weight,
            key: q.key,
            orderIndex: qIndex,
            options:
              q.optionsText && q.optionsText.trim().length > 0
                ? q.optionsText
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean)
                : [],
          })),
        })),
      };

      const res = await fetch(`/api/assessment-templates/${detail.id}/structure`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        throw new Error("Failed to save sections and questions");
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message ?? "Failed to save sections and questions");
    } finally {
      setSavingStructure(false);
    }
  }

  return (
    <div className="relative flex flex-col gap-6 lg:flex-row">
      {/* LEFT: Template list */}
      <aside className="w-full lg:w-64 lg:flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              Assessment templates
            </p>
            <p className="text-[11px] text-slate-500">
              SOC2, ISO, and your own questionnaires.
            </p>
          </div>
        </div>

        <button onClick={handleCreateTemplate} className="btn-primary w-full mb-3">
          <span aria-hidden>ï¼‹</span>
          <span>New template</span>
        </button>

        <div className="glass-soft space-y-1 rounded-2xl p-2 max-h-[480px] overflow-y-auto">
          {templates.length === 0 ? (
            <p className="text-[11px] text-slate-500 px-2 py-3">
              No templates yet. Create your first SOC2 or baseline assessment to
              get started.
            </p>
          ) : (
            templates.map((t) => {
              const isActive = t.id === selectedId;
              return (
                <button
                  key={t.id}
                  onClick={() => setSelectedId(t.id)}
                  className={`w-full rounded-xl px-3 py-2 text-left text-[12px] transition ${
                    isActive
                      ? "bg-slate-800/90 text-emerald-200 border border-emerald-400/50"
                      : "bg-transparent text-slate-200 hover:bg-slate-900/80 border border-transparent"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold truncate">{t.name}</span>
                    {t.assessmentCount > 0 && (
                      <span className="text-[10px] text-slate-400">
                        {t.assessmentCount} used
                      </span>
                    )}
                  </div>
                  {t.standard && (
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {t.standard}
                    </p>
                  )}
                  {t.category && (
                    <p className="text-[10px] text-slate-500">{t.category}</p>
                  )}
                </button>
              );
            })
          )}
        </div>
      </aside>

      {/* RIGHT: Builder */}
      <section className="flex-1">
        {error && (
          <div className="mb-3 rounded-2xl border border-rose-500/60 bg-rose-950/40 px-3 py-2 text-[11px] text-rose-100">
            {error}
          </div>
        )}

        {!selectedId || !detail ? (
          <div className="glass-soft rounded-3xl border border-dashed border-slate-700 bg-slate-950/60 px-4 py-8 text-sm text-slate-400">
            {loadingDetail
              ? "Loading template€¦"
              : "Select a template from the left to edit its details and questions."}
          </div>
        ) : (
          <>
            {/* Meta card */}
            <div className="glass-soft rounded-3xl px-4 py-4 mb-5 shadow-lg shadow-black/40">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="flex-1 space-y-2">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-400">
                      Template name
                    </label>
                    <input
                      value={detail.name}
                      onChange={(e) => updateDetailMeta({ name: e.target.value })}
                      className="input-glass mt-1 text-sm"
                      placeholder="e.g., SOC2 Core Controls, Vendor Cyber Hygiene"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-400">
                        Standard
                      </label>
                      <input
                        value={detail.standard ?? ""}
                        onChange={(e) =>
                          updateDetailMeta({ standard: e.target.value })
                        }
                        className="input-glass mt-1 text-[12px]"
                        placeholder="e.g., SOC 2, ISO 27001, Custom"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-400">
                        Category
                      </label>
                      <input
                        value={detail.category ?? ""}
                        onChange={(e) =>
                          updateDetailMeta({ category: e.target.value })
                        }
                        className="input-glass mt-1 text-[12px]"
                        placeholder="e.g., Security, Privacy, TPRM"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-400">
                        Version
                      </label>
                      <input
                        value={detail.version ?? ""}
                        onChange={(e) =>
                          updateDetailMeta({ version: e.target.value })
                        }
                        className="input-glass mt-1 text-[12px]"
                        placeholder="e.g., v1.0"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-400">
                      Description
                    </label>
                    <textarea
                      value={detail.description ?? ""}
                      onChange={(e) =>
                        updateDetailMeta({ description: e.target.value })
                      }
                      rows={3}
                      className="input-glass mt-1 text-sm resize-none"
                      placeholder="Short explanation of when to use this template and what it covers."
                    />
                  </div>

                  <label className="inline-flex items-center gap-2 text-[11px] text-slate-400">
                    <input
                      type="checkbox"
                      checked={detail.isActive}
                      onChange={(e) =>
                        updateDetailMeta({ isActive: e.target.checked })
                      }
                      className="h-3 w-3 rounded border-slate-600 bg-slate-900"
                    />
                    <span>Active and available to use for new assessments</span>
                  </label>
                </div>

                <div className="flex flex-col gap-2 items-end">
                  <button
                    onClick={saveMeta}
                    disabled={savingMeta}
                    className="btn-glass text-[11px] px-3 py-1.5 rounded-full"
                  >
                    {savingMeta ? "Saving€¦" : "Save details"}
                  </button>
                  <p className="text-[10px] text-slate-500 max-w-[200px] text-right">
                    These fields drive how this template shows up in your
                    assessment picker and reports.
                  </p>
                </div>
              </div>
            </div>

            {/* Sections & questions */}
            <div className="glass-soft rounded-3xl px-4 py-4 shadow-lg shadow-black/40">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Sections &amp; questions
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Group questions into logical sections for vendors and reviewers.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={addSection}
                    className="btn-glass text-[11px] px-3 py-1.5 rounded-full"
                  >
                    <span aria-hidden>ï¼‹</span>
                    <span>Section</span>
                  </button>
                  <button
                    onClick={saveStructure}
                    disabled={savingStructure}
                    className="btn-primary text-[11px] px-3 py-1.5 rounded-full"
                  >
                    {savingStructure ? "Saving€¦" : "Save questions"}
                  </button>
                </div>
              </div>

              {detail.sections.length === 0 ? (
                <p className="text-[12px] text-slate-500 border border-dashed border-slate-700 rounded-2xl px-3 py-4 bg-slate-950/70">
                  No sections yet. Add a section and start dropping in questions
                  like &ldquo;Do you enforce MFA for all admin accounts?&rdquo;
                </p>
              ) : (
                <div className="space-y-4">
                  {detail.sections.map((section, sIndex) => (
                    <div
                      key={sIndex}
                      className="glass-soft rounded-2xl border border-slate-800 bg-slate-950/90 px-3 py-3"
                    >
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex-1 space-y-1">
                          <input
                            value={section.title}
                            onChange={(e) =>
                              updateSection(sIndex, { title: e.target.value })
                            }
                            className="input-glass text-[13px]"
                            placeholder={`Section ${sIndex + 1} title`}
                          />
                          <textarea
                            value={section.description ?? ""}
                            onChange={(e) =>
                              updateSection(sIndex, { description: e.target.value })
                            }
                            rows={2}
                            className="input-glass text-[12px] resize-none"
                            placeholder="Optional section description visible to vendors."
                          />
                        </div>
                        <button
                          onClick={() => removeSection(sIndex)}
                          className="text-[11px] text-slate-500 hover:text-rose-300"
                        >
                          Remove
                        </button>
                      </div>

                      <div className="space-y-2">
                        {section.questions.length === 0 ? (
                          <p className="text-[11px] text-slate-500 border border-dashed border-slate-700 rounded-xl px-2 py-2">
                            No questions in this section yet.
                          </p>
                        ) : (
                          section.questions.map((q, qIndex) => (
                            <div
                              key={qIndex}
                              className="glass-soft rounded-xl border border-slate-800 bg-slate-950 px-2 py-2"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 space-y-1">
                                  <input
                                    value={q.prompt}
                                    onChange={(e) =>
                                      updateQuestion(sIndex, qIndex, {
                                        prompt: e.target.value,
                                      })
                                    }
                                    className="input-glass text-[13px]"
                                    placeholder="Question prompt (e.g., Do you enforce MFA for all admin users?)"
                                  />
                                  <textarea
                                    value={q.helpText ?? ""}
                                    onChange={(e) =>
                                      updateQuestion(sIndex, qIndex, {
                                        helpText: e.target.value,
                                      })
                                    }
                                    rows={2}
                                    className="input-glass text-[11px] resize-none"
                                    placeholder="Optional guidance for the vendor filling this question."
                                  />
                                </div>
                                <button
                                  onClick={() => removeQuestion(sIndex, qIndex)}
                                  className="text-[11px] text-slate-500 hover:text-rose-300"
                                >
                                  œ•
                                </button>
                              </div>

                              <div className="mt-2 grid grid-cols-1 md:grid-cols-4 gap-2">
                                <div>
                                  <label className="block text-[10px] text-slate-400">
                                    Answer type
                                  </label>
                                  <select
                                    value={q.kind}
                                    onChange={(e) =>
                                      updateQuestion(sIndex, qIndex, {
                                        kind: e.target.value as QuestionKind,
                                      })
                                    }
                                    className="input-glass mt-1 text-[11px]"
                                  >
                                    <option value="YES_NO">Yes / No</option>
                                    <option value="TEXT">Free text</option>
                                    <option value="SELECT">
                                      Single choice (select)
                                    </option>
                                    <option value="MULTI_SELECT">Multi-select</option>
                                    <option value="NUMBER">Number</option>
                                  </select>
                                </div>
                                <div>
                                  <label className="block text-[10px] text-slate-400">
                                    Options (comma-separated)
                                  </label>
                                  <input
                                    value={q.optionsText ?? ""}
                                    onChange={(e) =>
                                      updateQuestion(sIndex, qIndex, {
                                        optionsText: e.target.value,
                                      })
                                    }
                                    className="input-glass mt-1 text-[11px]"
                                    placeholder="Yes, No, N/A"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[10px] text-slate-400">
                                    Weight (optional)
                                  </label>
                                  <input
                                    type="number"
                                    value={q.weight ?? ""}
                                    onChange={(e) =>
                                      updateQuestion(sIndex, qIndex, {
                                        weight:
                                          e.target.value === ""
                                            ? null
                                            : Number(e.target.value),
                                      })
                                    }
                                    className="input-glass mt-1 text-[11px]"
                                    placeholder="e.g., 10"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[10px] text-slate-400">
                                    Key (optional)
                                  </label>
                                  <input
                                    value={q.key ?? ""}
                                    onChange={(e) =>
                                      updateQuestion(sIndex, qIndex, { key: e.target.value })
                                    }
                                    className="input-glass mt-1 text-[11px]"
                                    placeholder="e.g., access_control.mfa_enabled"
                                  />
                                </div>
                              </div>

                              <label className="mt-2 inline-flex items-center gap-2 text-[10px] text-slate-400">
                                <input
                                  type="checkbox"
                                  checked={q.required}
                                  onChange={(e) =>
                                    updateQuestion(sIndex, qIndex, {
                                      required: e.target.checked,
                                    })
                                  }
                                  className="h-3 w-3 rounded border-slate-600 bg-slate-900"
                                />
                                <span>Required question</span>
                              </label>
                            </div>
                          ))
                        )}

                        <button
                          onClick={() => addQuestion(sIndex)}
                          className="btn-glass mt-1 text-[11px] px-2.5 py-1 rounded-full"
                        >
                          <span aria-hidden>ï¼‹</span>
                          <span>Add question</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}


