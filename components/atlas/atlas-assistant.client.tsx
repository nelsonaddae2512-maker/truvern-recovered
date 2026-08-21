"use client";

import { useMemo, useState, type FormEvent } from "react";
import Link from "next/link";

type AssistantNode = {
  id: string;
  label: string;
  type: string;
  features: string[];
  impactScore: number;
  metadata: Record<string, unknown>;
};

type AssistantResult = {
  intent: string;
  question: string;
  answer: string;
  confidence: number;
  primaryNode: AssistantNode | null;
  nodes: AssistantNode[];
  related: AssistantNode[];
  affectedFeatures: string[];
  counts: Record<string, number>;
  evidence: Array<{ label: string; value: string }>;
  suggestions: string[];
};

const EXAMPLES = [
  "Where is vendor onboarding implemented?",
  "What depends on EvidenceRequest?",
  "What changes if I modify the Vendor model?",
  "Show the highest-impact architecture hotspots.",
  "Show dependency cycles.",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isAssistantNode(value: unknown): value is AssistantNode {
  if (!isRecord(value)) return false;

  return (
    typeof value.id === "string" &&
    typeof value.label === "string" &&
    typeof value.type === "string" &&
    Array.isArray(value.features) &&
    value.features.every((feature) => typeof feature === "string") &&
    typeof value.impactScore === "number" &&
    isRecord(value.metadata)
  );
}

function isAssistantResult(value: unknown): value is AssistantResult {
  if (!isRecord(value)) return false;

  return (
    typeof value.intent === "string" &&
    typeof value.question === "string" &&
    typeof value.answer === "string" &&
    typeof value.confidence === "number" &&
    (value.primaryNode === null || isAssistantNode(value.primaryNode)) &&
    Array.isArray(value.nodes) &&
    value.nodes.every(isAssistantNode) &&
    Array.isArray(value.related) &&
    value.related.every(isAssistantNode) &&
    Array.isArray(value.affectedFeatures) &&
    value.affectedFeatures.every((feature) => typeof feature === "string") &&
    isRecord(value.counts) &&
    Object.values(value.counts).every((count) => typeof count === "number") &&
    Array.isArray(value.evidence) &&
    value.evidence.every(
      (item) =>
        isRecord(item) &&
        typeof item.label === "string" &&
        typeof item.value === "string",
    ) &&
    Array.isArray(value.suggestions) &&
    value.suggestions.every((suggestion) => typeof suggestion === "string")
  );
}

function extractErrorMessage(
  payload: unknown,
  fallback: string,
): string {
  if (
    isRecord(payload) &&
    typeof payload.error === "string" &&
    payload.error.trim()
  ) {
    return payload.error;
  }

  return fallback;
}

function nodeTypeLabel(type: string) {
  return type === "api"
    ? "API"
    : type.charAt(0).toUpperCase() + type.slice(1);
}

function ResultNode({
  node,
  primary = false,
}: {
  node: AssistantNode;
  primary?: boolean;
}) {
  return (
    <article
      className={`rounded-2xl border p-4 ${
        primary
          ? "border-cyan-300/25 bg-cyan-400/[0.065]"
          : "border-white/10 bg-white/[0.025]"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">
            {nodeTypeLabel(node.type)}
          </div>
          <h3 className="mt-2 break-words font-semibold text-white">
            {node.label}
          </h3>
          <p className="mt-1 break-all text-xs leading-5 text-slate-500">
            {node.id}
          </p>
        </div>
        <div className="shrink-0 rounded-xl bg-amber-300/[0.08] px-3 py-2 text-center">
          <div className="text-[10px] uppercase tracking-[0.16em] text-amber-200/70">
            Impact
          </div>
          <div className="font-semibold text-amber-200">{node.impactScore}</div>
        </div>
      </div>

      {node.features.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {node.features.slice(0, 8).map((feature) => (
            <span
              key={feature}
              className="rounded-full border border-indigo-300/15 bg-indigo-400/[0.08] px-2.5 py-1 text-xs text-indigo-200"
            >
              {feature}
            </span>
          ))}
        </div>
      ) : null}
    </article>
  );
}

export default function AtlasAssistant() {
  const [question, setQuestion] = useState(EXAMPLES[0]);
  const [result, setResult] = useState<AssistantResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const confidenceLabel = useMemo(() => {
    if (!result) return "â€”";
    if (result.confidence >= 0.8) return "High";
    if (result.confidence >= 0.45) return "Moderate";
    return "Low";
  }, [result]);

  async function ask(event?: FormEvent) {
    event?.preventDefault();
    const normalized = question.trim();
    if (!normalized) return;

    setLoading(true);
    setFailure(null);

    try {
      const response = await fetch("/api/truvern/atlas/assistant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: normalized }),
      });

      const payload: unknown = await response.json();

      if (!response.ok) {
        throw new Error(
          extractErrorMessage(
            payload,
            `Assistant API returned ${response.status}`,
          ),
        );
      }

      if (!isAssistantResult(payload)) {
        throw new Error(
          "ATLAS assistant returned an invalid response payload.",
        );
      }

      setResult(payload);
    } catch (error) {
      setFailure(
        error instanceof Error
          ? error.message
          : "ATLAS could not answer the question.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <header className="rounded-3xl border border-cyan-400/15 bg-gradient-to-br from-cyan-400/[0.09] via-slate-950 to-indigo-400/[0.06] p-6 shadow-2xl shadow-cyan-950/20">
        <div className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-300">
          Truvern Operations Â· ATLAS-04A
        </div>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          Architecture Assistant
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400 sm:text-base">
          Ask natural-language questions about Truvernâ€™s architecture. Every
          answer is grounded in the generated dependency graph and includes
          inspectable architecture evidence.
        </p>

        <form onSubmit={ask} className="mt-6">
          <textarea
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            rows={3}
            placeholder="Ask what implements a feature, what depends on a model, or what a proposed change could affectâ€¦"
            className="w-full resize-y rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-400/40 focus:ring-2 focus:ring-cyan-400/10"
          />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {EXAMPLES.map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => setQuestion(example)}
                  className="rounded-full border border-white/10 bg-white/[0.035] px-3 py-1.5 text-xs text-slate-400 transition hover:border-cyan-300/20 hover:text-cyan-100"
                >
                  {example}
                </button>
              ))}
            </div>
            <button
              type="submit"
              disabled={loading || !question.trim()}
              className="rounded-xl bg-cyan-400 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Analyzing graphâ€¦" : "Ask ATLAS"}
            </button>
          </div>
        </form>
      </header>

      {failure ? (
        <div className="mt-5 rounded-2xl border border-rose-400/20 bg-rose-400/[0.08] p-5 text-sm text-rose-100">
          <div className="font-semibold">Architecture assistant unavailable</div>
          <p className="mt-1 text-rose-200/75">{failure}</p>
        </div>
      ) : null}

      {result ? (
        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_390px]">
          <div className="space-y-5">
            <section className="rounded-3xl border border-white/10 bg-slate-950/75 p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
                    {result.intent}
                  </div>
                  <h2 className="mt-2 text-xl font-semibold text-white">
                    ATLAS answer
                  </h2>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2 text-sm text-slate-300">
                  Confidence:{" "}
                  <span className="font-semibold text-white">
                    {confidenceLabel}
                  </span>
                </div>
              </div>

              <p className="mt-5 text-base leading-7 text-slate-200">
                {result.answer}
              </p>

              {result.primaryNode ? (
                <div className="mt-5">
                  <ResultNode node={result.primaryNode} primary />
                </div>
              ) : null}
            </section>

            {result.nodes.length ? (
              <section className="rounded-3xl border border-white/10 bg-slate-950/75 p-5">
                <div className="flex items-center justify-between gap-4">
                  <h2 className="font-semibold text-white">
                    Matched architecture assets
                  </h2>
                  <span className="rounded-full bg-white/5 px-2.5 py-1 text-xs text-slate-400">
                    {result.nodes.length}
                  </span>
                </div>
                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  {result.nodes.map((node) => (
                    <ResultNode key={node.id} node={node} />
                  ))}
                </div>
              </section>
            ) : null}

            {result.related.length ? (
              <section className="rounded-3xl border border-white/10 bg-slate-950/75 p-5">
                <div className="flex items-center justify-between gap-4">
                  <h2 className="font-semibold text-white">
                    Related architecture exposure
                  </h2>
                  <span className="rounded-full bg-white/5 px-2.5 py-1 text-xs text-slate-400">
                    {result.related.length}
                  </span>
                </div>
                <div className="mt-4 max-h-[700px] space-y-2 overflow-y-auto pr-1">
                  {result.related.map((node) => (
                    <div
                      key={node.id}
                      className="flex items-center justify-between gap-4 rounded-xl border border-white/5 bg-white/[0.025] px-3 py-2"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-slate-100">
                          {node.label}
                        </div>
                        <div className="mt-1 truncate text-xs text-slate-500">
                          {nodeTypeLabel(node.type)} Â· {node.id}
                        </div>
                      </div>
                      <span className="shrink-0 text-xs font-semibold text-amber-200">
                        {node.impactScore}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
          </div>

          <aside className="space-y-5">
            <section className="rounded-2xl border border-cyan-300/15 bg-cyan-400/[0.045] p-4">
              <h3 className="font-semibold text-white">Architecture evidence</h3>
              <div className="mt-3 space-y-3">
                {result.evidence.map((item) => (
                  <div
                    key={`${item.label}-${item.value}`}
                    className="rounded-xl bg-slate-950/45 px-3 py-2"
                  >
                    <div className="text-xs uppercase tracking-[0.16em] text-slate-500">
                      {item.label}
                    </div>
                    <div className="mt-1 break-words text-sm text-slate-200">
                      {item.value}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {Object.keys(result.counts).length ? (
              <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
                <h3 className="font-semibold text-white">Impact summary</h3>
                <div className="mt-3 space-y-2">
                  {Object.entries(result.counts).map(([label, value]) => (
                    <div
                      key={label}
                      className="flex items-center justify-between rounded-lg bg-slate-950/45 px-3 py-2 text-sm"
                    >
                      <span className="text-slate-400">{label}</span>
                      <span className="font-semibold text-white">{value}</span>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {result.affectedFeatures.length ? (
              <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
                <h3 className="font-semibold text-white">Affected features</h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  {result.affectedFeatures.map((feature) => (
                    <span
                      key={feature}
                      className="rounded-full border border-indigo-300/15 bg-indigo-400/[0.08] px-2.5 py-1 text-xs text-indigo-200"
                    >
                      {feature}
                    </span>
                  ))}
                </div>
              </section>
            ) : null}

            <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
              <h3 className="font-semibold text-white">Recommended next steps</h3>
              <ol className="mt-3 space-y-3">
                {result.suggestions.map((suggestion, index) => (
                  <li
                    key={suggestion}
                    className="flex gap-3 text-sm leading-6 text-slate-300"
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cyan-400/10 text-xs font-semibold text-cyan-200">
                      {index + 1}
                    </span>
                    <span>{suggestion}</span>
                  </li>
                ))}
              </ol>
            </section>

            <Link
              href="/truvern/ops/atlas"
              className="block rounded-xl border border-cyan-300/20 bg-cyan-400/[0.07] px-4 py-3 text-center text-sm font-semibold text-cyan-100 transition hover:bg-cyan-400/[0.12]"
            >
              Continue in Architecture Explorer
            </Link>
          </aside>
        </div>
      ) : (
        <section className="mt-5 rounded-3xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-16 text-center">
          <h2 className="text-lg font-semibold text-white">
            Ask ATLAS an architecture question
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-500">
            The assistant searches the local Truvern dependency graph. It does
            not require an external AI key and does not send repository data to
            a third party.
          </p>
        </section>
      )}
    </div>
  );
}

