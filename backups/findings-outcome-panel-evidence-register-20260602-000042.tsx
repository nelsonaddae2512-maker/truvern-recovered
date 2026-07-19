"use client";

import { useMemo, useState } from "react";


function pickReviewerText(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }
  }

  return "Not recorded.";
}

function pickReviewerArray(...values: unknown[]) {
  for (const value of values) {
    if (Array.isArray(value)) return value;
  }

  return [];
}

function reviewerIntelligenceFromResponses(responses: any) {
  return (
    responses?.truvernReviewerIntelligence ??
    responses?.reviewerIntelligence ??
    responses?.intelligence ??
    responses?.reviewOutcome ??
    null
  );
}

function resolveExecutiveSummary(responses: any) {
  const intelligence = reviewerIntelligenceFromResponses(responses);

  return pickReviewerText(
    responses?.executiveSummary,
    responses?.summary,
    responses?.reviewOutcome?.executiveSummary,
    responses?.releasePacket?.executiveSummary,
    intelligence?.executiveSummary,
  );
}

function resolveFinalAssessment(responses: any) {
  const intelligence = reviewerIntelligenceFromResponses(responses);

  return pickReviewerText(
    responses?.finalAssessment,
    responses?.finalRecommendation,
    responses?.reviewOutcome?.finalAssessment,
    responses?.releasePacket?.finalAssessment,
    intelligence?.finalAssessment,
    intelligence?.finalRecommendation,
  );
}

function resolveReviewerFollowUps(responses: any) {
  const intelligence = reviewerIntelligenceFromResponses(responses);

  return pickReviewerArray(
    responses?.followUps,
    responses?.conditions,
    responses?.reviewerConditions,
    responses?.truvernRemediation?.reviewerConditions,
    intelligence?.followUps,
  );
}

function resolveReviewerTimeline(responses: any) {
  const intelligence = reviewerIntelligenceFromResponses(responses);

  return pickReviewerArray(
    responses?.timeline,
    responses?.reviewTimeline,
    intelligence?.timeline,
    responses?.truvernRemediation?.history,
  );
}
type Finding = {
  id?: string;
  title?: string;
  severity?: string;
  description?: string;
  recommendation?: string;
};

function cleanText(value: unknown) {
  return String(value ?? "")
    .replaceAll("â€¢", "•")
    .replaceAll("â€”", "—")
    .replaceAll("â€“", "–")
    .replaceAll("â€˜", "'")
    .replaceAll("â€™", "'")
    .replaceAll("â€œ", "\"")
    .replaceAll("â€", "\"")
    .trim();
}

function safeArray(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}

function severityTone(severity: unknown) {
  const value = cleanText(severity).toUpperCase();

  if (value === "HIGH" || value === "CRITICAL") {
    return "border-red-400/30 bg-red-500/15 text-red-100";
  }

  if (value === "MEDIUM") {
    return "border-amber-400/30 bg-amber-500/15 text-amber-100";
  }

  if (value === "LOW") {
    return "border-emerald-400/30 bg-emerald-500/15 text-emerald-100";
  }

  return "border-slate-400/30 bg-slate-500/15 text-slate-100";
}

function groupFindings(findings: Finding[]) {
  const groups = {
    high: findings.filter((item) => ["HIGH", "CRITICAL"].includes(cleanText(item.severity).toUpperCase())),
    medium: findings.filter((item) => cleanText(item.severity).toUpperCase() === "MEDIUM"),
    low: findings.filter((item) => cleanText(item.severity).toUpperCase() === "LOW"),
  };

  return [
    { label: "High", severity: "HIGH", items: groups.high },
    { label: "Medium", severity: "MEDIUM", items: groups.medium },
    { label: "Low", severity: "LOW", items: groups.low },
  ].filter((group) => group.items.length > 0);
}

function fallbackFindingsFromText(text: string): Finding[] {
  return cleanText(text)
    .split(/\n+/)
    .map((line) => cleanText(line).replace(/^[-•]\s*/, ""))
    .filter(Boolean)
    .slice(0, 8)
    .map((line, index) => ({
      id: `draft-${index}`,
      title: line.length > 120 ? `${line.slice(0, 120)}...` : line,
      severity: index === 0 ? "MEDIUM" : "LOW",
      description: line,
    }));
}

export default function FindingsOutcomePanel({
  assignmentId,
  responses,
  riskLevel,
  decision,
  reviewFindings,
  executiveSummary,
  finalAssessment,
  canRerunIntelligence = false,
}: {
  assignmentId: number;
  responses: any;
  riskLevel?: string | null;
  decision?: string | null;
  reviewFindings?: string | null;
  executiveSummary?: string | null;
  finalAssessment?: string | null;
  canRerunIntelligence?: boolean;
}) {
  const [generating, setGenerating] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const intelligence = responses?.truvernReviewerIntelligence ?? {};
  const remediation = responses?.truvernRemediation ?? {};

  

  const reviewerFollowUps = resolveReviewerFollowUps(responses);
  const reviewerTimeline = resolveReviewerTimeline(responses);

  const evidenceItems = [
    ...safeArray(responses?.evidenceManifest?.items),
    ...safeArray(responses?.evidence),
    ...safeArray(responses?.evidenceItems),
    ...safeArray(responses?.attachments),
    ...safeArray(responses?.uploadedFiles),
    ...safeArray(remediation.requests),
    ...safeArray(remediation.attestationRequests),
  ];const generatedFindings = safeArray(intelligence.findings);
  const textFindings = fallbackFindingsFromText(reviewFindings ?? responses?.findings ?? "");

  const findings = (generatedFindings.length ? generatedFindings : textFindings) as Finding[];
  const grouped = groupFindings(findings);
  const visibleGroups = showAll ? grouped : grouped.slice(0, 3);  const derivedFollowUps =
    reviewerFollowUps.length > 0
      ? reviewerFollowUps
      : findings
          .map((finding) => cleanText(finding.recommendation || finding.title))
          .filter(Boolean);

  const derivedEvidenceItems =
    evidenceItems.length > 0
      ? evidenceItems
      : findings
          .filter((finding: any) => finding.remediationRequired || finding.attestationRequired || cleanText(finding.recommendation))
          .map((finding) => cleanText(finding.title))
          .filter(Boolean);

  const derivedTimeline =
    reviewerTimeline.length > 0
      ? reviewerTimeline
      : findings.length > 0
        ? [
            {
              label: "Reviewer intelligence generated",
              count: findings.length,
            },
          ]
        : [];



  const cleanedExecutiveSummary =
    cleanText(intelligence.executiveSummary) ||
    cleanText(executiveSummary) ||
    "Not recorded.";

  const cleanedFinalAssessment =
    cleanText(intelligence.finalRecommendation) ||
    cleanText(finalAssessment) ||
    "Not recorded.";

  async function rerunIntelligence() {
    setGenerating(true);

    await fetch(`/api/review-desk/reviews/${assignmentId}/generate-findings`, {
      method: "POST",
    });

    setGenerating(false);
    window.location.reload();
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-[#050b1a]/80 p-5 shadow-[0_0_40px_rgba(8,145,178,0.08)]">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-cyan-200">
            Findings and outcome
          </p>
          <p className="mt-2 text-sm text-slate-400">
            Generated reviewer intelligence, compact findings, executive summary, and final assessment.
          </p>
        </div>

        {canRerunIntelligence ? (
        <button
          type="button"
          onClick={rerunIntelligence}
          disabled={generating}
          className="rounded-2xl border border-cyan-300/30 bg-cyan-300/10 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:border-cyan-200/60 hover:bg-cyan-300/20 disabled:opacity-60"
        >
          {generating ? "Generating..." : "Re-run intelligence"}
        </button>
        ) : null}
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div>
          <p className="text-sm font-semibold text-white">Risk level</p>
          <div className="mt-2 rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white">
            {cleanText(riskLevel) || cleanText(responses?.riskLevel) || "Not recorded"}
          </div>
        </div>

        <div>
          <p className="text-sm font-semibold text-white">Decision</p>
          <div className="mt-2 rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white">
            {cleanText(decision) || cleanText(responses?.decision) || "Not recorded"}
          </div>
        </div>
      </div>

      <div className="mt-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-white">Review findings</p>
          {findings.length > 3 ? (
            <button
              type="button"
              onClick={() => setShowAll((value) => !value)}
              className="rounded-xl border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs font-semibold text-cyan-100"
            >
              {showAll ? "Show less" : `Show all findings (${findings.length})`}
            </button>
          ) : null}
        </div>

        <div className="mt-3 overflow-hidden rounded-2xl border border-white/10 bg-slate-950/50 shadow-[0_0_20px_rgba(34,211,238,0.05)]">
          {visibleGroups.length ? visibleGroups.map((group) => (
            <details key={group.severity} className="group border-b border-white/10 last:border-b-0">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3">
                <div className="flex min-w-0 items-center gap-4">
                  <span className={`rounded-full border px-3 py-1 text-xs font-bold uppercase ${severityTone(group.severity)}`}>
                    {group.label}
                  </span>
                  <span className="truncate text-sm font-semibold text-white">
                    {cleanText(group.items[0]?.title) || `${group.label} finding`}
                  </span>
                </div>
                <span className="rounded-full border border-white/10 bg-white/10 px-2 py-1 text-xs text-slate-200">
                  {group.items.length}
                </span>
              </summary>

              <div className="space-y-3 border-t border-white/10 px-4 py-4">
                {group.items.map((finding, index) => (
                  <div key={finding.id ?? `${group.severity}-${index}`} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <p className="text-sm font-semibold text-white">
                      {cleanText(finding.title) || `Finding ${index + 1}`}
                    </p>
                    {cleanText(finding.description) ? (
                      <p className="mt-2 text-sm leading-6 text-slate-300">
                        {cleanText(finding.description)}
                      </p>
                    ) : null}
                    {cleanText(finding.recommendation) ? (
                      <p className="mt-2 text-sm leading-6 text-cyan-100">
                        Recommendation: {cleanText(finding.recommendation)}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            </details>
          )) : (
            <div className="p-4 text-sm text-slate-400">
              No generated findings yet. Truvern Ops can generate reviewer intelligence after the submitted questionnaire and evidence are ready.
            </div>
          )}
        </div>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <details open className="min-h-[260px] rounded-2xl border border-white/10 bg-slate-950/60 p-5">
          <summary className="cursor-pointer list-none text-sm font-semibold text-white">
            Executive summary
          </summary>
          <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-200">
            {cleanedExecutiveSummary}
          </p>
        </details>

        <details open className="min-h-[260px] rounded-2xl border border-white/10 bg-slate-950/60 p-5">
          <summary className="cursor-pointer list-none text-sm font-semibold text-white">
            Final assessment
          </summary>
          <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-200">
            {cleanedFinalAssessment}
          </p>
        </details>
      </div>

      <div className="mt-4 grid gap-3">
        {[
          ["Conditions & follow-ups", derivedFollowUps.length],
          ["Evidence snapshot", derivedEvidenceItems.length],
          ["Review timeline", derivedTimeline.length],
        ].map(([label, count]) => (
          <details key={label} className="rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3">
            <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold text-white">
              <span>
                {label}
                <span className="ml-2 rounded-full bg-cyan-300/15 px-2 py-1 text-xs text-cyan-100">
                  {String(count)}
                </span>
              </span>
              <span className="text-slate-400">⌄</span>
            </summary>
            <div className="mt-3">
              {label === "Conditions & follow-ups" ? (
                <div className="space-y-2">
                  {derivedFollowUps.map((item: any, index: number) => (
                    <div
                      key={index}
                      className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-sm text-amber-100"
                    >
                      {String(item)}
                    </div>
                  ))}
                </div>
              ) : label === "Evidence snapshot" ? (
                <div className="space-y-2">
                  {derivedEvidenceItems.map((item: any, index: number) => (
                    <div
                      key={index}
                      className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-3 text-sm text-cyan-100"
                    >
                      {typeof item === "string"
                        ? item
                        : item?.title ??
                          item?.requestText ??
                          item?.description ??
                          JSON.stringify(item)}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {derivedTimeline.map((item: any, index: number) => (
                    <div
                      key={index}
                      className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-sm text-emerald-100"
                    >
                      {typeof item === "string"
                        ? item
                        : item?.label ??
                          item?.title ??
                          JSON.stringify(item)}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}









