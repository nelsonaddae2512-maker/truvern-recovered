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
    .replaceAll("€¢", "•")
    .replaceAll("€”", "—")
    .replaceAll("€“", "–")
    .replaceAll("€˜", "'")
    .replaceAll("€™", "'")
    .replaceAll("€œ", "\"")
    .replaceAll("€", "\"")
    .trim();
}

function sameDisplayText(a: unknown, b: unknown) {
  const left = cleanText(a).replace(/\s+/g, " ").trim().toLowerCase();
  const right = cleanText(b).replace(/\s+/g, " ").trim().toLowerCase();
  return Boolean(left && right && left === right);
}

function stripGovernancePacketSections(value: unknown) {
  const text = cleanText(value);
  if (!text) return "";

  return text
    .replace(/EXECUTIVE SUMMARY[\s\S]*?(?=TRUVERN GOVERNANCE REVIEW|CONDITIONS & FOLLOW-UPS|$)/gi, "")
    .replace(/GOVERNANCE DECISION[\s\S]*?(?=TRUVERN GOVERNANCE REVIEW|CONDITIONS & FOLLOW-UPS|$)/gi, "")
    .replace(/CONDITIONS & FOLLOW-UPS[\s\S]*$/gi, "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => {
      const upper = line.toUpperCase();
      return (
        line &&
        upper !== "EXECUTIVE SUMMARY" &&
        upper !== "GOVERNANCE DECISION" &&
        upper !== "TRUVERN GOVERNANCE REVIEW" &&
        upper !== "CONDITIONS & FOLLOW-UPS" &&
        !upper.startsWith("DECISION:") &&
        !upper.startsWith("RESIDUAL RISK ASSESSMENT:")
      );
    })
    .join("\n")
    .trim();
}

function formatDisplayDate(value: unknown) {
  const raw = cleanText(value);

  if (!raw) return "Not set";

  const date = new Date(raw);

  if (Number.isNaN(date.getTime())) return raw;

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
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
      description: "",
    }));
}


function normalizeRemediationPlanForDisplay(plan: any) {
  const title = cleanText(plan?.title || plan?.findingTitle || plan?.findingId || "");
  const text = title.toLowerCase();

  if (text.includes("backup") || text.includes("recovery") || text.includes("cp-9") || text.includes("cp-10")) {
    return {
      ...plan,
      control: "CP-9 / CP-10",
      controlFamily: "Contingency Planning",
      controlName: "System Backup and System Recovery",
      requiredEvidence: [
        "Documented backup and recovery procedure",
        "Backup retention schedule",
        "Restore or recovery test evidence",
        "Backup protection or immutability evidence",
      ],
      requiredAttestation: [
        "Backup and recovery control owner attestation",
        "Security or operations owner confirmation",
      ],
      recommendation:
        cleanText(plan?.recommendation) ||
        "Provide documented backup procedures, restore testing evidence, backup retention expectations, and proof that recovery responsibilities are assigned.",
      evidenceSignal:
        cleanText(plan?.evidenceSignal || plan?.description) ||
        "Vendor response indicated backup and recovery procedures are not maintained.",
    };
  }

  if (text.includes("policy") || text.includes("pl-2") || text.includes("pm-9")) {
    return {
      ...plan,
      control: "PL-2 / PM-9",
      controlFamily: "Planning / Program Management",
      controlName: "System Security Plan and Risk Management Strategy",
      requiredEvidence: [
        "Current security policy set",
        "Annual policy review record",
        "Policy approval evidence",
        "Policy owner assignment evidence",
      ],
      requiredAttestation: [
        "Security policy owner attestation",
        "Executive or security owner confirmation",
      ],
      recommendation:
        cleanText(plan?.recommendation) ||
        "Provide current policies, annual review evidence, approval records, and ownership attestation.",
      evidenceSignal:
        cleanText(plan?.evidenceSignal || plan?.description) ||
        "Vendor response indicated security policies are not reviewed at least annually.",
    };
  }

  if (text.includes("endpoint") || text.includes("si-3") || text.includes("si-4")) {
    return {
      ...plan,
      control: "SI-3 / SI-4",
      controlFamily: "System and Information Integrity",
      controlName: "Malicious Code Protection and System Monitoring",
      requiredEvidence: [
        "Endpoint protection deployment evidence",
        "Managed security tooling coverage report",
        "Malware or EDR policy",
        "Endpoint exception and remediation tracking evidence",
      ],
      requiredAttestation: [
        "Endpoint security owner attestation",
        "Security operations owner confirmation",
      ],
      recommendation:
        cleanText(plan?.recommendation) ||
        "Provide endpoint security tooling coverage, monitoring evidence, exception handling, and remediation tracking.",
      evidenceSignal:
        cleanText(plan?.evidenceSignal || plan?.description) ||
        "Vendor response indicated endpoints are not protected with managed security tooling.",
    };
  }

  if (text.includes("availability") || text.includes("ca-7") || text.includes("au-6")) {
    return {
      ...plan,
      control: "CA-7 / AU-6",
      controlFamily: "Security Assessment / Audit and Accountability",
      controlName: "Continuous Monitoring and Audit Review",
      requiredEvidence: [
        "Availability monitoring evidence",
        "Alerting and escalation procedure",
        "Critical system monitoring coverage report",
        "Monitoring owner attestation",
      ],
      requiredAttestation: [
        "Monitoring control owner attestation",
        "Risk owner confirmation",
      ],
      recommendation:
        cleanText(plan?.recommendation) ||
        "Provide availability monitoring coverage, alerting workflow, escalation evidence, and control ownership confirmation.",
      evidenceSignal:
        cleanText(plan?.evidenceSignal || plan?.description) ||
        "Vendor response indicated critical systems are not monitored for availability.",
    };
  }

  return plan;
}
export default function FindingsOutcomePanel({
  assignmentId,
  responses,
  riskLevel,
  decision,
  reviewFindings: _reviewFindings,
  executiveSummary,
  finalAssessment,
  canRerunIntelligence = false,
  evidenceSummary,
  liveRemediationRequests = [],
}: {
  assignmentId: number;
  responses: any;
  riskLevel?: string | null;
  decision?: string | null;
  reviewFindings?: string | null;
  executiveSummary?: string | null;
  finalAssessment?: string | null;
  canRerunIntelligence?: boolean;
  evidenceSummary?: any;
  liveRemediationRequests?: any[];
}) {
  const [generating, setGenerating] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const intelligence = responses?.truvernReviewerIntelligence ?? {};
  const remediation = responses?.truvernRemediation ?? {};
const reviewerFollowUps = resolveReviewerFollowUps(responses);
  const reviewerTimeline = resolveReviewerTimeline(responses);

  const remediationPlans =
    Array.isArray(liveRemediationRequests) && liveRemediationRequests.length > 0
      ? liveRemediationRequests.map((request: any) => {
          const status = cleanText(request?.status).toUpperCase() || "REQUESTED";
          const isClosed = ["RECEIVED", "APPROVED", "COMPLETED", "FULFILLED", "RESOLVED"].includes(status);

          return {
            ...request,
            id: request?.id,
            title: request?.title || request?.requestTitle || "Evidence remediation request",
            control: request?.kind || request?.control || request?.category || "Evidence request",
            severity: request?.severity || "REVIEW",
            status,
            evidenceStatus: request?.fulfilledEvidenceId || request?.fulfilledAt ? "RECEIVED" : "REQUESTED",
            attestationStatus: isClosed ? "APPROVED" : "REQUESTED",
            blockerStatus: isClosed ? "CLOSED" : "OPEN",
            requiredEvidence: Array.isArray(request?.requiredEvidence)
              ? request.requiredEvidence
              : request?.title
                ? [request.title]
                : [],
            requiredAttestation: Array.isArray(request?.requiredAttestation)
              ? request.requiredAttestation
              : [],
          };
        })
      : safeArray(remediation?.plans);

  const remediationAttestationCount = remediationPlans.reduce(
    (total: number, plan: any) => total + safeArray(plan?.requiredAttestation).length,
    0,
  );

  const generatedReleaseBlockers = remediationPlans.filter((plan: any) => {
    const status = cleanText(plan?.status).toUpperCase();
    const blockerStatus = cleanText(plan?.blockerStatus).toUpperCase();

    return (
      blockerStatus === "OPEN" ||
      blockerStatus === "ACTIVE" ||
      (status === "OPEN" || status === "REQUESTED") ||
      status === "REQUESTED" ||
      status === "PENDING"
    );
  }).length;

  const liveOpenRemediationRequests = Number(evidenceSummary?.openRemediationRequests);

  const activeReleaseBlockers = Number.isFinite(liveOpenRemediationRequests)
    ? liveOpenRemediationRequests
    : generatedReleaseBlockers;


  const evidenceItems = [
    ...safeArray(responses?.evidenceManifest?.items),
    ...safeArray(responses?.evidence),
    ...safeArray(responses?.evidenceItems),
    ...safeArray(responses?.attachments),
    ...safeArray(responses?.uploadedFiles),
    ...safeArray(remediation.requests),
    ...safeArray(remediation.attestationRequests),
    ...remediationPlans.flatMap((plan: any) => [
      ...safeArray(plan?.requiredEvidence),
      ...safeArray(plan?.requiredAttestation),
    ]),
  ];

  const remediationPlanEvidenceItems = safeArray(remediation.plans).flatMap((plan: any) => {
    const title = cleanText(plan?.title || plan?.control || plan?.findingId || "Governance remediation");

    const evidenceRows = safeArray(plan?.requiredEvidence).map((item: any) => ({
      type: "Evidence",
      title,
      text: cleanText(item),
      status: cleanText(plan?.evidenceStatus) || "REQUESTED",
      blockerStatus: cleanText(plan?.blockerStatus) || cleanText(plan?.status) || "OPEN",
    }));

    const attestationRows = safeArray(plan?.requiredAttestation).map((item: any) => ({
      type: "Attestation",
      title,
      text: cleanText(item),
      status: cleanText(plan?.evidenceStatus) || "REQUESTED",
      blockerStatus: cleanText(plan?.blockerStatus) || cleanText(plan?.status) || "OPEN",
    }));

    return [...evidenceRows, ...attestationRows].filter((item: any) => cleanText(item.text));
  });
  const generatedFindings = safeArray(intelligence.findings);
  const textFindings: Finding[] = [];

  const findings = generatedFindings as Finding[];
  const grouped = groupFindings(findings);
  const visibleGroups = showAll ? grouped : grouped.slice(0, 3);
  const remediationPlanFollowUps = remediationPlans.flatMap((plan: any) => {
    const title = cleanText(plan?.title || plan?.control || plan?.findingId || "Governance remediation");
    const rows: string[] = [];

    if (title) {
      rows.push(`Resolve: ${title}`);
    }

    const evidence = safeArray(plan?.requiredEvidence)
      .map((item: any) => cleanText(item))
      .filter(Boolean);

    if (evidence.length > 0) {
      rows.push(`Required evidence: ${evidence.join(", ")}.`);
    }

    const attestations = safeArray(plan?.requiredAttestation)
      .map((item: any) => cleanText(item))
      .filter(Boolean);

    if (attestations.length > 0) {
      rows.push(`Required attestation: ${attestations.join(", ")}.`);
    }

    rows.push(`Status: ${cleanText(plan?.status) || "OPEN"} · Evidence: ${cleanText(plan?.evidenceStatus) || "REQUESTED"} · Blocker: ${cleanText(plan?.blockerStatus) || "OPEN"}.`);

    return rows;
  });

  const openRemediationPlans = remediationPlans.filter((plan: any) => {
    const status = cleanText(plan?.status).toUpperCase();
    const blocker = cleanText(plan?.blockerStatus).toUpperCase();

    return (
      blocker === "OPEN" ||
      blocker === "ACTIVE" ||
      (status === "OPEN" || status === "REQUESTED") ||
      status === "REQUESTED" ||
      status === "PENDING"
    );
  });

  const derivedFollowUps =
    openRemediationPlans.length > 0
      ? openRemediationPlans
          .map((plan: any) =>
            `Resolve: ${cleanText(
              plan?.title ||
                plan?.control ||
                plan?.findingId ||
                "Governance remediation",
            )}`,
          )
          .filter(Boolean)
      : reviewerFollowUps.length > 0
        ? reviewerFollowUps
        : [];

  const evidenceKey = (item: any) =>
    [
      cleanText(typeof item === "string" ? item : item?.title),
      cleanText(typeof item === "string" ? item : item?.text),
      cleanText(typeof item === "string" ? item : item?.description),
      cleanText(typeof item === "string" ? item : item?.requestText),
    ]
      .filter(Boolean)
      .join("|");

  const sourceEvidenceItems =
    evidenceItems.length > 0
      ? evidenceItems
      : findings
          .flatMap((finding: any) => {
            const title = cleanText(finding.title);
            const recommendation = cleanText(finding.recommendation);
            return recommendation
              ? [
                  {
                    type: "Evidence",
                    title,
                    text: recommendation,
                    status: "REQUESTED",
                    blockerStatus:
                      finding.remediationRequired || finding.attestationRequired
                        ? "OPEN"
                        : "REVIEW",
                  },
                ]
              : [];
          })
          .filter((item: any) => cleanText(item?.text || item));

  const derivedEvidenceItems = Array.from(
    new Map(
      sourceEvidenceItems
        .filter((item: any) => evidenceKey(item))
        .map((item: any) => [evidenceKey(item), item]),
    ).values(),
  );
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

  async function runRemediationAction(action: string, plan: any) {
    try {
      const response = await fetch(
        `/api/review-desk/reviews/${assignmentId}/remediation-action`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action,
            findingId:
              plan?.id ||
              plan?.findingId ||
              plan?.title ||
              plan?.control,
            title:
              plan?.title ||
              plan?.findingId ||
              plan?.control,
          }),
        },
      );

      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || `Remediation action failed. HTTP ${response.status}`);
      }

      window.location.reload();
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : "Unable to perform remediation action.");
    }
  }

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


      {remediationPlans.length > 0 ? (
        <div className="mt-5 grid gap-3 rounded-2xl border border-white/10 bg-slate-950/50 p-4 sm:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-xl border border-rose-400/20 bg-rose-400/10 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-rose-200">Findings</p>
            <p className="mt-2 text-2xl font-semibold text-white">{findings.length}</p>
          </div>
          <div className="rounded-xl border border-amber-400/20 bg-amber-400/10 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-200">Follow-up actions</p>
            <p className="mt-2 text-2xl font-semibold text-white">{derivedFollowUps.length}</p>
          </div>
          <div className="rounded-xl border border-cyan-400/20 bg-cyan-400/10 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-200">Evidence items</p>
            <p className="mt-2 text-2xl font-semibold text-white">{derivedEvidenceItems.length}</p>
          </div>
          <div className="rounded-xl border border-violet-400/20 bg-violet-400/10 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-200">Attestations</p>
            <p className="mt-2 text-2xl font-semibold text-white">{remediationAttestationCount}</p>
          </div>
          <div className="rounded-xl border border-red-400/20 bg-red-400/10 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-red-200">Release blockers</p>
            <p className="mt-2 text-2xl font-semibold text-white">{activeReleaseBlockers}</p>
          </div>
        </div>
      ) : null}

      {remediationPlans.length > 0 ? (
        <div className="mt-5 rounded-2xl border border-cyan-400/15 bg-cyan-400/5 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-cyan-200">
                Remediation plans
              </p>
              <p className="mt-1 text-sm text-slate-300">
                Control-specific evidence and attestation requirements generated from vendor answers.
              </p>
            </div>
            <span className="rounded-full bg-cyan-300/15 px-3 py-1 text-xs font-semibold text-cyan-100">
              {remediationPlans.length}
            </span>
          </div>

          <div className="mt-4 grid gap-3">
            {remediationPlans.map((plan: any, index: number) => {
              const displayPlan = normalizeRemediationPlanForDisplay(plan);
              const evidence = safeArray(displayPlan?.requiredEvidence).map(cleanText).filter(Boolean);
              const attestations = safeArray(displayPlan?.requiredAttestation).map(cleanText).filter(Boolean);

                              return (
                <div key={`${cleanText(displayPlan?.id || displayPlan?.findingId || displayPlan?.title)}-${index}`} className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-white">
                        {cleanText(displayPlan?.title || displayPlan?.findingId || "Governance remediation plan")}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        {cleanText(displayPlan?.control) || "Control pending"} · {cleanText(displayPlan?.controlFamily) || "Governance control"} · Due: {formatDisplayDate(displayPlan?.dueAt)}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-[0.14em]">
                      <span className="rounded-full border border-amber-300/30 bg-amber-300/10 px-2 py-1 text-amber-100">{cleanText(displayPlan?.severity) || "REVIEW"}</span>
                      <span className="rounded-full border border-cyan-300/30 bg-cyan-300/10 px-2 py-1 text-cyan-100">{cleanText(displayPlan?.status) || "OPEN"}</span>
                      <span className="rounded-full border border-rose-300/30 bg-rose-300/10 px-2 py-1 text-rose-100">{cleanText(displayPlan?.blockerStatus) || "OPEN"}</span>
                    </div>
                  </div>

                  {evidence.length > 0 ? (
                    <div className="mt-4 rounded-xl border border-cyan-400/15 bg-cyan-400/5 p-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">Required evidence</p>
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-cyan-50">
                        {evidence.map((item: string, itemIndex: number) => (
                          <li key={`plan-evidence-${index}-${itemIndex}`}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {attestations.length > 0 ? (
                    <div className="mt-3 rounded-xl border border-violet-400/15 bg-violet-400/5 p-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-200">Required attestations</p>
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-violet-50">
                        {attestations.map((item: string, itemIndex: number) => (
                          <li key={`plan-attestation-${index}-${itemIndex}`}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {cleanText(displayPlan?.recommendation) ? (
                    <div className="mt-3 rounded-xl border border-emerald-400/15 bg-emerald-400/5 p-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200">Recommendation</p>
                      <p className="mt-2 text-sm leading-6 text-emerald-50">{cleanText(displayPlan.recommendation)}</p>
                    </div>
                  ) : null}

                  {cleanText(displayPlan?.evidenceSignal) ? (
                    <div className="mt-3 rounded-xl border border-sky-400/15 bg-sky-400/5 p-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-200">Evidence signal</p>
                      <p className="mt-2 text-sm leading-6 text-sky-50">{cleanText(displayPlan.evidenceSignal)}</p>
                    </div>
                  ) : null}

                  <div className="mt-4 flex flex-wrap gap-2">
                    {cleanText(displayPlan?.blockerStatus).toUpperCase() === "CLOSED" ||
                    cleanText(displayPlan?.status).toUpperCase() === "APPROVED" ? (
                      <button
                        type="button"
                        onClick={() => runRemediationAction("REOPEN_REMEDIATION", displayPlan)}
                        className="rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-2 text-xs font-semibold text-amber-100 hover:bg-amber-300/20"
                      >
                        Reopen finding
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => runRemediationAction("REQUEST_EVIDENCE", displayPlan)}
                          className="rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-2 text-xs font-semibold text-cyan-100 hover:bg-cyan-300/20"
                        >
                          Request evidence
                        </button>
                        <button
                          type="button"
                          onClick={() => runRemediationAction("REQUEST_ATTESTATION", displayPlan)}
                          className="rounded-full border border-violet-300/30 bg-violet-300/10 px-3 py-2 text-xs font-semibold text-violet-100 hover:bg-violet-300/20"
                        >
                          Request attestation
                        </button>
                        <button
                          type="button"
                          onClick={() => runRemediationAction("APPROVE_REMEDIATION", displayPlan)}
                          className="rounded-full border border-emerald-300/30 bg-emerald-300/10 px-3 py-2 text-xs font-semibold text-emerald-100 hover:bg-emerald-300/20"
                        >
                          Approve remediation
                        </button>
                        {cleanText(displayPlan?.status).toUpperCase() !== "REJECTED" ? (
                          <button
                            type="button"
                            onClick={() => runRemediationAction("REJECT_REMEDIATION", displayPlan)}
                            className="rounded-full border border-rose-300/30 bg-rose-300/10 px-3 py-2 text-xs font-semibold text-rose-100 hover:bg-rose-300/20"
                          >
                            Reject
                          </button>
                        ) : null}
                      </>
                    )}
                  </div>

                  <div className="mt-3 grid gap-2 text-xs sm:grid-cols-4">
                    <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                      <p className="text-slate-400">Evidence status</p>
                      <p className="mt-1 font-semibold text-white">{cleanText(displayPlan?.evidenceStatus) || "REQUESTED"}</p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                      <p className="text-slate-400">Attestation status</p>
                      <p className="mt-1 font-semibold text-white">{attestations.length > 0 ? (cleanText(displayPlan?.attestationStatus) || "REQUESTED") : "NOT REQUIRED"}</p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                      <p className="text-slate-400">Remediation status</p>
                      <p className="mt-1 font-semibold text-white">{cleanText(displayPlan?.status) || "OPEN"}</p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                      <p className="text-slate-400">Release blocker</p>
                      <p className="mt-1 font-semibold text-white">{cleanText(displayPlan?.blockerStatus) || "OPEN"}</p>
                    </div>
                  </div>

                  <p className={`mt-3 rounded-xl p-3 text-sm ${
                    cleanText(displayPlan?.blockerStatus).toUpperCase() === "CLOSED"
                      ? "border border-emerald-400/15 bg-emerald-400/5 text-emerald-100"
                      : "border border-amber-400/15 bg-amber-400/5 text-amber-100"
                  }`}>
                    {cleanText(displayPlan?.blockerStatus).toUpperCase() === "CLOSED"
                      ? "Release blocker cleared. Finding is ready for governance release review."
                      : "Release blocked pending remediation or attestation review."}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
      <div className="mt-4 grid gap-3">
        {[
          ["Conditions & follow-ups", derivedFollowUps.length],
          ["Evidence snapshot", derivedEvidenceItems.length],
          ["Review timeline", derivedTimeline.length],
        ].map(([label, count]) => (
          <details key={label} open className="rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3">
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
                  {derivedFollowUps.length > 0 ? (
                    derivedFollowUps.map((item: any, index: number) => (
                      <div
                        key={index}
                        className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-sm text-amber-100"
                      >
                        {String(item)}
                      </div>
                    ))
                  ) : (
                    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm text-emerald-200">
                      No open governance follow-ups. All remediation requirements have been completed and validated.
                    </div>
                  )}
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







































