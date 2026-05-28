      "use client";

function isInternalReviewLabel(value: unknown) {
  return String(value ?? "").trim().toUpperCase() !== "TRUVERN";
}

function approvalLanguage(assignmentType: unknown) {
  const internal = isInternalReviewLabel(assignmentType);

  return {
    awaitingConfirmation: internal ? "Pending approval" : "Awaiting confirmation",
    awaitingCustomerConfirmation: internal
      ? "Pending internal approval"
      : "Awaiting customer confirmation",
    releasedByGovernance: internal ? "Submitted for approval" : "Released by governance",
    confirmReleasedOutcome: internal ? "Approve review" : "Confirm released outcome",
    outcomeRelease: internal ? "Ready for approval" : "Outcome release",
    panelDescription: internal
      ? "This internal governance review is complete and awaiting organizational approval before finalization."
      : "This internal governance review is complete and awaiting organizational approval before finalization.",
  };
}

import Link from "next/link";
import { governanceLabel } from "@/lib/governance/labels";
import EvidenceRequestForm from "@/components/evidence-request-form";
import { useEffect, useState } from "react";

type AnalystOption = {
  userId: string;
  name: string;
  email?: string | null;
};

type TruvernCreditRouteResponse = {
  ok?: boolean;
  code?: string;
  error?: string;
  detail?: string;
  requiredCredits?: number;
  availableCredits?: number;
  reservedCredits?: number;
  consumedCredits?: number;
  effectiveCredits?: number;
  fundingUrl?: string;
};

type Props = {
  vendor: { id: number; name: string; category: string | null; organizationId?: number | null };
    canManageTruvernReview?: boolean;
assignment: {
    id: number;
    status: string;
    assignmentType: string;
    assignedReviewerName: string;
    createdAt: string | null;
    updatedAt: string | null;
  };
  request: { id: number | null; status: string };
  evidenceSummary: {
    totalEvidence: number;
    pendingRequests: number;
    completedRequests: number;
    openRemediationRequests?: number;
    approvedRemediationRequests?: number;
    rejectedRemediationRequests?: number;
    submittedRemediationRequests?: number;
    overdueRemediationRequests?: number;
    releaseBlocked?: boolean;
  };
  vendorAnswers?: Array<{
    assessmentId: number;
    assessmentStatus: string;
    score: number | null;
    questionId: number;
    prompt: string;
    questionType: string;
    value: string | null;
    createdAt: string | null;
    updatedAt: string | null;
  }>;

  remediationRequests?: Array<{
    id: number;
    title: string;
    kind: string;
    status: string;
    dueAt: string | null;
    createdAt: string | null;
    updatedAt: string | null;
  }>;

  latestOutcome: {
    id: number | null;
    status: string;
    decision: string | null;
    riskLevel: string | null;
    releaseState: string | null;
    manifestId?: number | null;
    manifestChecksum?: string | null;
    manifestVersion?: string | null;
    governanceVersion?: string | null;
    findings: string;
    updatedAt: string | null;
    generatedDraft?: {
      schema: string;
      generatedAt: string | null;
      summary: string;
      recommendations: unknown[];
      structuredAssessment?: Record<string, any> | null;
    };
  };
  auditEvents: Array<{ label: string; at: string | null; detail: string }>;
  analysts?: AnalystOption[];
};

type Tone = "cyan" | "emerald" | "amber" | "slate" | "rose" | "violet";

function upper(v: unknown) {
  return typeof v === "string" ? v.trim().toUpperCase() : "";
}

function remediationChipClass(status: string) {
  const s = String(status || "").toUpperCase();

  if (["RECEIVED", "APPROVED", "COMPLETED", "FULFILLED", "RESOLVED"].includes(s)) {
    return "border-emerald-400/25 bg-emerald-400/10 text-emerald-100";
  }

  if (["REJECTED", "FAILED"].includes(s)) {
    return "border-rose-400/25 bg-rose-400/10 text-rose-100";
  }

  if (["SUBMITTED", "UNDER_REVIEW"].includes(s)) {
    return "border-cyan-400/25 bg-cyan-400/10 text-cyan-100";
  }

  return "border-amber-400/25 bg-amber-400/10 text-amber-100";
}

function chipClass(tone: Tone) {
  const base =
    "rounded-2xl border px-3 py-1 text-xs font-medium uppercase tracking-[0.18em]";

  if (tone === "emerald") return `${base} border-emerald-400/25 bg-emerald-500/10 text-emerald-100`;
  if (tone === "amber") return `${base} border-amber-400/25 bg-amber-500/10 text-amber-100`;
  if (tone === "rose") return `${base} border-rose-400/25 bg-rose-500/10 text-rose-100`;
  if (tone === "cyan") return `${base} border-cyan-400/25 bg-cyan-500/10 text-cyan-100`;
  if (tone === "violet") return `${base} border-violet-400/25 bg-violet-500/10 text-violet-100`;

  return `${base} border-white/10 bg-white/[0.04] text-slate-200`;
}

function statusTone(status: string): Tone {
  const s = upper(status);

  if (s === "AWAITING_CONFIRMATION") return "amber";
  if (["CONFIRMED", "COMPLETED", "SUBMITTED", "COMPLETE"].includes(s)) return "emerald";
  if (s === "RELEASED") return "cyan";
  if (["PENDING", "REQUESTED", "IN_REVIEW", "IN_PROGRESS", "SAVE_DRAFT"].includes(s)) return "amber";
  if (["CANCELLED", "REJECTED", "FAILED"].includes(s)) return "rose";

  return "slate";
}

function formatDate(value: string | null) {
  if (!value) return "Not recorded";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "Not recorded";
  return d.toLocaleString();
}

function sectionFromText(
  text: string,
  heading: string,
  nextHeadings: string[],
) {
  const source = text || "";
  const start = source.toUpperCase().indexOf(heading.toUpperCase());

  if (start < 0) return "";

  const afterHeading = source.slice(start + heading.length).trim();

  let end = afterHeading.length;

  for (const next of nextHeadings) {
    const idx = afterHeading.toUpperCase().indexOf(next.toUpperCase());
    if (idx >= 0 && idx < end) end = idx;
  }

  return afterHeading.slice(0, end).trim();
}

export default function ReviewAssignmentWorkspace({
  vendor,
  canManageTruvernReview = false,
  assignment,
  request,
  evidenceSummary,
  vendorAnswers = [],
  remediationRequests = [],
  latestOutcome,
  auditEvents,
  analysts = [],
}: Props) {
  const isTruvern = upper(assignment.assignmentType) === "TRUVERN";
  const showTruvernOperatorControls = isTruvern && canManageTruvernReview;
  const truvernCustomerView = isTruvern && !canManageTruvernReview;
  const assignmentStatus = upper(assignment.status);
  const outcomeStatus = upper(latestOutcome.status);
  const releaseState = upper(latestOutcome.releaseState);

  const outcomeConfirmed = releaseState === "CONFIRMED";
  const outcomeReleased = releaseState === "RELEASED" || outcomeStatus === "RELEASED";
  const awaitingCustomerConfirmation = outcomeReleased && !outcomeConfirmed;

  const displayStatus = outcomeConfirmed
    ? "CONFIRMED"
    : awaitingCustomerConfirmation
      ? "AWAITING_CONFIRMATION"
      : outcomeStatus === "COMPLETE"
        ? "COMPLETED"
        : assignmentStatus || "OPEN";

  const rawReviewerName = assignment.assignedReviewerName || "";
  const reviewerName =
    isTruvern && (!rawReviewerName || rawReviewerName.toLowerCase().includes("internal reviewer"))
      ? "Truvern expert"
      : rawReviewerName || "Unassigned";
  const editingLocked =
    outcomeReleased ||
    outcomeConfirmed ||
    truvernCustomerView;

  const canCancelPendingTruvernReview =
    isTruvern &&
    assignmentStatus === "PENDING" &&
    !outcomeReleased &&
    !outcomeConfirmed;
  const canGenerateTruvernDraft =
    showTruvernOperatorControls &&
    !outcomeReleased &&
    !outcomeConfirmed;
  const reviewerUnassigned = !reviewerName || reviewerName === "Unassigned";
  const reviewInProgress =
    assignmentStatus === "IN_PROGRESS" && !awaitingCustomerConfirmation && !outcomeConfirmed;

  const structured = latestOutcome.generatedDraft?.structuredAssessment || {};

  const [riskLevel, setRiskLevel] = useState(latestOutcome.riskLevel || "");
  const [decision, setDecision] = useState(latestOutcome.decision || "");
  const [findings, setFindings] = useState(latestOutcome.findings || "");
  const initialExecutiveSummary =
  typeof structured.executiveSummary === "string" &&
  structured.executiveSummary.trim()
    ? structured.executiveSummary.trim()
    : sectionFromText(latestOutcome.findings, "EXECUTIVE SUMMARY", [
        "GOVERNANCE DECISION",
        "TRUVERN GOVERNANCE REVIEW",
        "CONDITIONS & FOLLOW-UPS",
      ]);

const initialFinalAssessment =
  typeof structured.finalAssessment === "string" &&
  structured.finalAssessment.trim()
    ? structured.finalAssessment.trim()
    : sectionFromText(latestOutcome.findings, "TRUVERN GOVERNANCE REVIEW", [
        "CONDITIONS & FOLLOW-UPS",
      ]);

  const initialRecommendations =
    Array.isArray(structured.conditionsAndFollowUps) &&
    structured.conditionsAndFollowUps.length > 0
      ? structured.conditionsAndFollowUps.join("\n")
      : [
          "Continue periodic governance monitoring.",
          "Maintain evidence and operational control documentation.",
          "Notify customers of material operational or security changes when applicable.",
        ].join("\n");

  const [executiveSummary, setExecutiveSummary] = useState(
    initialExecutiveSummary,
  );
  const [finalAssessment, setFinalAssessment] = useState(
    initialFinalAssessment,
  );
  const [recommendationsText, setRecommendationsText] = useState(
    initialRecommendations,
  );

  const [selectedAnalystId, setSelectedAnalystId] = useState("");
  const [newAnalystName, setNewAnalystName] = useState("");
  const [newAnalystEmail, setNewAnalystEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [generatingDraft, setGeneratingDraft] = useState(false);
  const [message, setMessage] = useState("");
  const [showTruvernCreditPanel, setShowTruvernCreditPanel] = useState(false);
  const [acceptedTruvernCreditSpend, setAcceptedTruvernCreditSpend] = useState(false);
  const [truvernCreditError, setTruvernCreditError] =
    useState<TruvernCreditRouteResponse | null>(null);
  const [showReleasePreview, setShowReleasePreview] = useState(false);
  const [acceptedAcknowledgement, setAcceptedAcknowledgement] = useState(false);
  const [unlockReason, setUnlockReason] = useState("");
  const [acceptedUnlockOverride, setAcceptedUnlockOverride] = useState(false);
  const [unlockingEditing, setUnlockingEditing] = useState(false);

  useEffect(() => {
    if (!message) return;

    const timer = window.setTimeout(() => {
      setMessage("");
    }, 4000);

    return () => window.clearTimeout(timer);
  }, [message]);


  async function addAnalyst() {
    if (!vendor.organizationId || !newAnalystEmail.trim()) return;

    try {
      setSaving(true);
      setMessage("");

      const res = await fetch("/api/review-desk/analysts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          organizationId: vendor.organizationId,
          name: newAnalystName,
          email: newAnalystEmail,
        }),
      });

      const raw = await res.text();
      console.log("TRUVERN_ROUTE_RAW", raw);
      const data = raw ? JSON.parse(raw) : null;

      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "Failed to add analyst.");
      }

      setMessage("Analyst added. Refreshing list...");
      setTimeout(() => {
        window.location.reload();
      }, 1200);
    } catch (error: any) {
      setMessage(error?.message || "Failed to add analyst.");
    } finally {
      setSaving(false);
    }
  }

  async function assignAnalyst() {
    if (!selectedAnalystId || editingLocked) return;

    const analyst =
      analysts.find((a) => a.userId === selectedAnalystId);

    if (!analyst) return;

    try {
      setSaving(true);
      setMessage("");

      const res = await fetch(
        `/api/review-desk/reviews/${assignment.id}/assign`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            action: "assign",
            reviewerUserId: analyst.userId,
            reviewerName: analyst.name,
          }),
        },
      );

      const data = await res.json();

      if (!res.ok || !data?.ok) {
        throw new Error(
          data?.error || "Failed to assign analyst.",
        );
      }

      setMessage("Analyst assigned successfully.");

      setTimeout(() => {
        window.location.reload();
      }, 1200);
    } catch (error: any) {
      setMessage(
        error?.message || "Failed to assign analyst.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function unassignReview() {
    if (editingLocked && !canCancelPendingTruvernReview) return;

    try {
      setSaving(true);
      setMessage("");

      const res = await fetch(
        `/api/review-desk/reviews/${assignment.id}/assign`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            action: "unassign",
          }),
        },
      );

      const data = await res.json();

      if (!res.ok || !data?.ok) {
        throw new Error(
          data?.error || "Failed to unassign review.",
        );
      }

      setMessage("Review unassigned.");

      setTimeout(() => {
        window.location.reload();
      }, 1200);
    } catch (error: any) {
      setMessage(
        error?.message || "Failed to unassign review.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function routeToTruvern() {
    if (editingLocked) return;

    if (!acceptedTruvernCreditSpend) {
      setShowTruvernCreditPanel(true);
      setMessage("Review the Truvern credit reservation before routing.");
      return;
    }

    try {
      setSaving(true);
      setMessage("");
      setTruvernCreditError(null);

      const res = await fetch(
        `/api/review-desk/reviews/${assignment.id}/assign`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            action: "truvern",
          }),
        },
      );

      const data = (await res.json().catch(() => ({}))) as TruvernCreditRouteResponse;

      if (!res.ok || !data?.ok) {
        if (
          res.status === 402 ||
          data?.code === "TRUVERN_ACCESS_REQUIRED" ||
          data?.code === "INSUFFICIENT_CREDITS"
        ) {
          setTruvernCreditError(data);
          setShowTruvernCreditPanel(true);
          setAcceptedTruvernCreditSpend(false);
          setMessage("");
          return;
        }

        throw new Error(data?.error || data?.detail || data?.code || "Failed to route to Truvern.");
      }

      setMessage("Review routed to Truvern. Credit reserved.");

      setTimeout(() => {
        window.location.reload();
      }, 1200);
    } catch (error: any) {
      setMessage(error?.message || "Failed to route to Truvern.");
    } finally {
      setSaving(false);
    }
  }

  async function claimAssignment() {
    if (editingLocked) return;

    try {
      setSaving(true);
      setMessage("");

      const res = await fetch(`/api/review-desk/reviews/${assignment.id}/claim`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          reviewerUserId: "local-reviewer",
          reviewerName:
  upper(assignment.assignmentType) === "TRUVERN"
    ? "Truvern expert"
    : "Internal reviewer",
        }),
      });

      const data = await res.json();

      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "Failed to claim assignment.");
      }

      setMessage("Assignment claimed successfully.");
      setTimeout(() => {
        window.location.reload();
      }, 1200);
    } catch (error: any) {
      setMessage(error?.message || "Failed to claim assignment.");
    } finally {
      setSaving(false);
    }
  }

  async function generateDraft() {
    if (!canGenerateTruvernDraft) return;

    try {
      setGeneratingDraft(true);
      setMessage("");

      const res = await fetch(`/api/review-desk/reviews/${assignment.id}/generate-draft`, {
        method: "POST",
      });

      const data = await res.json();

      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "Failed to generate assessment.");
      }

      setMessage("Truvern Findings Engine generated an assessment successfully.");
      setTimeout(() => {
        window.location.reload();
      }, 1200);
    } catch (error: any) {
      setMessage(error?.message || "Failed to generate assessment.");
    } finally {
      setGeneratingDraft(false);
    }
  }

  async function submitOutcome(intent: "SAVE_DRAFT" | "COMPLETE" | "RELEASE") {
    if (editingLocked) return;

    try {
      setSaving(true);
      setMessage("");

      const cleanedFinalAssessment = finalAssessment
        .split("CONDITIONS & FOLLOW-UPS")[0]
        .trim();

      const cleanedExecutiveSummary = executiveSummary
        .replace(/GOVERNANCE DECISION[\s\S]*/gi, "")
        .replace(/Decision:.*$/gim, "")
        .replace(/Residual risk assessment:.*$/gim, "")
        .trim();

      const missingReleaseFields = [
        !cleanedExecutiveSummary ? "Executive summary" : null,
        !cleanedFinalAssessment ? "Final assessment" : null,
        !recommendationsText.trim() ? "Conditions & follow-ups" : null,
        !riskLevel ? "Risk level" : null,
        !decision ? "Governance decision" : null,
      ].filter(Boolean);

      if (
        (intent === "COMPLETE" || intent === "RELEASE") &&
        missingReleaseFields.length
      ) {
        setMessage(
          `Complete these fields before ${intent === "RELEASE" ? "release" : "completion"}: ${missingReleaseFields.join(", ")}.`,
        );
        setSaving(false);
        return;
      }


      if (
        intent === "RELEASE" &&
        Boolean(evidenceSummary.releaseBlocked && (evidenceSummary.openRemediationRequests ?? 0) > 0)
      ) {
        setMessage(
          "Governance release is blocked until all remediation evidence requests are resolved.",
        );
        setSaving(false);
        return;
      }
      const releaseFindings = [
        "EXECUTIVE SUMMARY",
        cleanedExecutiveSummary,
        "",
        "GOVERNANCE DECISION",
        `Decision: ${governanceLabel(decision) || "Pending"}`,
        `Residual risk assessment: ${governanceLabel(riskLevel) || "Medium"}`,
        "",
        "TRUVERN GOVERNANCE REVIEW",
        cleanedFinalAssessment,
        "",
        "CONDITIONS & FOLLOW-UPS",
        recommendationsText.trim(),
      ]
        .filter((part) => part !== null && part !== undefined)
        .join("\n");

      const res = await fetch(`/api/review-desk/reviews/${assignment.id}/outcome`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          intent,
          assignmentType: assignment.assignmentType,
          riskLevel,
          decision,
          findings: releaseFindings,
          structuredAssessment: {
            ...(latestOutcome.generatedDraft?.structuredAssessment || {}),
            executiveSummary: cleanedExecutiveSummary,
            finalAssessment: cleanedFinalAssessment,
            conditionsAndFollowUps: recommendationsText
              .split("\n")
              .map((v) => v.trim())
              .filter(Boolean),
          },
        }),
      });

      const data = await res.json();

      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "Failed to save outcome.");
      }

      setMessage(
        intent === "SAVE_DRAFT"
          ? "Assessment saved successfully."
          : intent === "COMPLETE"
            ? "Review marked complete."
            : `${approvalLanguage(assignment.assignmentType).outcomeRelease}d successfully.`,
      );

      setTimeout(() => {
        window.location.reload();
      }, 1200);
    } catch (error: any) {
      setMessage(error?.message || "Failed to save outcome.");
    } finally {
      setSaving(false);
    }
  }

  async function unlockEditing() {
    if (!canManageTruvernReview || !editingLocked) return;

    try {
      setUnlockingEditing(true);
      setMessage("");

      const res = await fetch(`/api/review-desk/reviews/${assignment.id}/unlock-editing`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          acceptedOverride: acceptedUnlockOverride,
          reason: unlockReason,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "Failed to unlock editing.");
      }

      setMessage("Editing unlocked by Truvern operator override.");

      setTimeout(() => {
        window.location.reload();
      }, 900);
    } catch (error: any) {
      setMessage(error?.message || "Failed to unlock editing.");
    } finally {
      setUnlockingEditing(false);
    }
  }
  async function confirmRelease() {
    if (!awaitingCustomerConfirmation) return;

    try {
      setSaving(true);
      setMessage("");

      const res = await fetch(`/api/review-desk/reviews/${assignment.id}/confirm-release`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          acceptedAcknowledgement,
          acknowledgementType: isTruvern
            ? "CUSTOMER_RELEASE_CONFIRMATION"
            : "TRUVERN_OPERATOR_OVERRIDE",
        }),
      });

      const data = await res.json();

      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "Failed to confirm release.");
      }

      setMessage(
  assignment.assignmentType === "INTERNAL"
    ? "Internal review approved."
    : "Governance outcome confirmed."
);
      setTimeout(() => {
        window.location.reload();
      }, 1200);
    } catch (error: any) {
      setMessage(error?.message || "Failed to confirm release.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {message ? (
        <div className="fixed right-6 top-6 z-[9999] max-w-md rounded-2xl border border-emerald-400/30 bg-emerald-500 px-5 py-4 text-sm font-semibold text-slate-950 shadow-2xl shadow-black/40">
          {message}
        </div>
      ) : null}

    <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-8 shadow-2xl shadow-slate-950/40">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-cyan-200/90">
            Review assignment workspace
          </p>

          <h3 className="mt-3 text-3xl font-semibold text-white">
            {isTruvern ? "Truvern expert review" : "Internal governance review"}
          </h3>

          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
            {isTruvern
              ? "This assignment is routed to Truvern experts. Outcomes remain hidden until Truvern releases the review."
              : "This assignment is ready for internal review, evidence validation, findings, outcome drafting, and release."}
          </p>

          <div className="mt-5 flex flex-wrap gap-3">
            <span className={chipClass(statusTone(displayStatus))}>{displayStatus}</span>
            <span className={chipClass(isTruvern ? "cyan" : "emerald")}>
              {assignment.assignmentType || "INTERNAL"}
            </span>
            <span className={chipClass("slate")}>Reviewer: {reviewerName}</span>
            <span className={chipClass("slate")}>Request #{request.id ?? "—"}</span>
            <span className={chipClass("slate")}>Assignment #{assignment.id}</span>

            {latestOutcome.id ? (
              <span className={chipClass(statusTone(outcomeStatus || "DRAFT"))}>
                {outcomeStatus === "SAVE_DRAFT"
                  ? "Assessment prepared"
                  : `Outcome ${outcomeStatus || "DRAFT"}`}
              </span>
            ) : null}

            {outcomeConfirmed ? (
              <span className={chipClass("emerald")}>
  {assignment.assignmentType === "INTERNAL"
    ? "Internal review approved"
    : "Governance finalized"}
</span>
            ) : awaitingCustomerConfirmation ? (
              <span className={chipClass("amber")}>{approvalLanguage(assignment.assignmentType).awaitingCustomerConfirmation}</span>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col gap-3">
          {reviewerUnassigned && !editingLocked ? (
            <button
              type="button"
              disabled={saving}
              onClick={claimAssignment}
              className="rounded-2xl border border-cyan-300/20 bg-cyan-400/10 px-5 py-3 text-sm font-medium text-cyan-50 hover:bg-cyan-400/15 disabled:opacity-50"
            >
              {saving ? "Assigning..." : "Assign to me"}
            </button>
          ) : null}

          {!editingLocked ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">
                Add analyst
              </p>

              <input
                value={newAnalystName}
                onChange={(e) => setNewAnalystName(e.target.value)}
                placeholder="Name"
                className="mb-2 w-full rounded-xl border border-white/10 bg-[#041426] px-3 py-2 text-sm text-white outline-none"
              />

              <input
                value={newAnalystEmail}
                onChange={(e) => setNewAnalystEmail(e.target.value)}
                placeholder="Email"
                className="mb-2 w-full rounded-xl border border-white/10 bg-[#041426] px-3 py-2 text-sm text-white outline-none"
              />

              <button
                type="button"
                disabled={saving || !newAnalystEmail.trim()}
                onClick={addAnalyst}
                className="w-full rounded-xl border border-emerald-300/20 bg-emerald-400/10 px-4 py-2 text-sm font-medium text-emerald-50 hover:bg-emerald-400/15 disabled:opacity-50"
              >
                Add analyst
              </button>
            </div>
          ) : null}

          {analysts.length > 0 && !editingLocked ? (
            <>
              <select
                value={selectedAnalystId}
                onChange={(e) =>
                  setSelectedAnalystId(e.target.value)
                }
                className="rounded-2xl border border-white/10 bg-[#041426] px-4 py-3 text-sm text-white outline-none"
              >
                <option value="">
                  Select analyst
                </option>

                {analysts.map((analyst) => (
                  <option
                    key={analyst.userId}
                    value={analyst.userId}
                  >
                    {analyst.name}
                  </option>
                ))}
              </select>

              <button
                type="button"
                disabled={!selectedAnalystId || saving}
                onClick={assignAnalyst}
                className="rounded-2xl border border-cyan-300/20 bg-cyan-400/10 px-5 py-3 text-sm font-medium text-cyan-50 hover:bg-cyan-400/15 disabled:opacity-50"
              >
                Assign analyst
              </button>

              <button
                type="button"
                disabled={saving}
                onClick={unassignReview}
                className="rounded-2xl border border-amber-300/20 bg-amber-400/10 px-5 py-3 text-sm font-medium text-amber-50 hover:bg-amber-400/15 disabled:opacity-50"
              >
                Unassign
              </button>

              {!isTruvern ? (
                <button
                  type="button"
                  onClick={() => {
                    setShowTruvernCreditPanel(true);
                    setTruvernCreditError(null);
                    setMessage("Review the Truvern credit reservation before routing.");
                  }}
                  className="group relative overflow-hidden rounded-3xl border border-cyan-300/30 bg-gradient-to-r from-cyan-500/20 via-sky-500/20 to-violet-500/20 px-6 py-5 text-left shadow-xl shadow-cyan-950/30 transition hover:scale-[1.01] hover:border-cyan-200/40 hover:from-cyan-400/30 hover:to-violet-400/30"
                >
                  <div className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-200">Truvern Expert Review</div>
                  <div className="mt-2 text-xl font-semibold text-white">Route to Truvern</div>
                  <p className="mt-2 text-sm leading-6 text-slate-200/80">Reserve credits and send this assessment to Truvern Ops.</p>
                  <div className="mt-3 inline-flex rounded-2xl border border-cyan-300/20 bg-black/30 px-4 py-2 text-sm font-semibold text-white">Cost: 1 Credit</div>
                </button>
              ) : null}
            </>
          ) : null}

          {canCancelPendingTruvernReview ? (
            <button
              type="button"
              disabled={saving}
              onClick={unassignReview}
              className="rounded-2xl border border-amber-300/25 bg-amber-400/10 px-5 py-3 text-center text-sm font-semibold text-amber-50 hover:bg-amber-400/15 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Cancelling..." : "Cancel Truvern review"}
            </button>
          ) : null}


          {showTruvernCreditPanel && !isTruvern ? (
            <div className="rounded-3xl border border-cyan-300/20 bg-slate-950/70 p-5 shadow-xl shadow-cyan-950/20">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-200">
                Truvern credit reservation
              </p>

              <h4 className="mt-3 text-xl font-semibold text-white">
                Confirm expert review spend
              </h4>

              <p className="mt-2 text-sm leading-6 text-slate-300">
                Truvern expert review is sold separately from platform plans. This action will reserve 1 Truvern credit before Truvern Ops begins review work.
              </p>

              {truvernCreditError ? (
                <div className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-400/10 p-4 text-sm text-amber-50">
                  <p className="font-semibold text-white">Purchase credits to continue</p>
                  <p className="mt-1 text-amber-100/90">
                    This organization does not have enough available Truvern credits for expert review.
                  </p>

                  <div className="mt-4 grid gap-2 text-xs sm:grid-cols-3">
                    <CreditMiniCard label="Available" value={truvernCreditError.availableCredits ?? 0} />
                    <CreditMiniCard label="Required" value={truvernCreditError.requiredCredits ?? 1} />
                    <CreditMiniCard label="Shortfall" value={Math.max((truvernCreditError.requiredCredits ?? 1) - (truvernCreditError.availableCredits ?? 0), 0)} accent />
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <a
                      href={`${truvernCreditError.fundingUrl || "/billing/credits"}?returnTo=/review-desk/reviews/${assignment.id}`}
                      className="rounded-2xl border border-cyan-300/30 bg-cyan-400/10 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100 hover:bg-cyan-400/20"
                    >
                      Purchase credits
                    </a>

                    <button
                      type="button"
                      onClick={() => {
                        setShowTruvernCreditPanel(false);
                        setTruvernCreditError(null);
                        setAcceptedTruvernCreditSpend(false);
                      }}
                      className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-white hover:bg-white/10"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="mt-4 grid gap-2 text-xs sm:grid-cols-3">
                    <CreditMiniCard label="Reservation" value={1} accent />
                    <CreditMiniCard label="Consumed at release" value={1} />
                    <CreditMiniCard label="Due now" value={1} />
                  </div>

                  <label className="mt-4 flex items-start gap-3 rounded-2xl border border-amber-300/20 bg-amber-400/10 p-4 text-sm text-slate-200">
                    <input
                      type="checkbox"
                      checked={acceptedTruvernCreditSpend}
                      onChange={(event) => setAcceptedTruvernCreditSpend(event.target.checked)}
                      className="mt-1 h-4 w-4 rounded border-white/20 bg-slate-950 text-cyan-400"
                    />
                    <span className="leading-6">
                      I acknowledge that routing this assignment to Truvern Ops will reserve 1 Truvern credit from this organization&apos;s balance.
                    </span>
                  </label>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={saving || !acceptedTruvernCreditSpend}
                      onClick={routeToTruvern}
                      className="rounded-2xl border border-cyan-300/30 bg-cyan-400/10 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100 hover:bg-cyan-400/20 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {saving ? "Routing..." : "Confirm and reserve credit"}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setShowTruvernCreditPanel(false);
                        setTruvernCreditError(null);
                        setAcceptedTruvernCreditSpend(false);
                      }}
                      className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-white hover:bg-white/10"
                    >
                      Cancel
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : null}

          <Link
            href={`/vendors/${vendor.id}`}
            className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-center text-sm font-medium text-white hover:bg-white/[0.08]"
          >
            View vendor
          </Link>
        </div>
      </div>



      {awaitingCustomerConfirmation ? (
        <div className="mt-6 rounded-3xl border border-amber-400/25 bg-amber-500/10 p-6">
          <p className="text-xs uppercase tracking-[0.3em] text-amber-200">
            {approvalLanguage(assignment.assignmentType).releasedByGovernance}
          </p>
          <h4 className="mt-3 text-2xl font-semibold text-white">
            {approvalLanguage(assignment.assignmentType).awaitingCustomerConfirmation}
          </h4>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
            The governance outcome has been released for customer review. Editing
            and reopen actions are locked. Confirm the release to close this
            review into audit history.
          </p>
          <label className="mt-5 flex items-start gap-3 rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4 text-sm text-slate-200">
            <input
              type="checkbox"
              checked={acceptedAcknowledgement}
              onChange={(event) => setAcceptedAcknowledgement(event.target.checked)}
              className="mt-1 h-4 w-4 rounded border-white/20 bg-slate-950 text-cyan-400"
            />

            <span className="leading-6">
              {isTruvern
                ? "I acknowledge that Truvern governance outcomes are operational governance assessments and not legal guarantees, certifications, warranties, or regulatory attestations. Final governance responsibility remains with my organization."
                : "I acknowledge I am approving or finalizing this governance outcome as an authorized Truvern operator on behalf of this workspace."}
            </span>
          </label>

          <button
            type="button"
            disabled={saving || !acceptedAcknowledgement}
            onClick={confirmRelease}
            className="mt-5 rounded-2xl border border-amber-300/20 bg-amber-400/10 px-5 py-3 text-sm font-semibold text-amber-50 hover:bg-amber-400/15 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Confirming..." : "Approve review"}
          </button>
        </div>
      ) : null}

      {outcomeConfirmed ? (
        <div className="mt-6 rounded-3xl border border-emerald-400/20 bg-emerald-500/10 p-6">
          <p className="text-xs uppercase tracking-[0.3em] text-emerald-200">
            Governance finalized
          </p>
          <h4 className="mt-3 text-2xl font-semibold text-white">
  {assignment.assignmentType === "INTERNAL"
    ? "Approved and finalized"
    : "Confirmed and closed for audit history"}
</h4>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
            This released outcome has been confirmed. The review is locked and
            preserved as the final governance record.
          </p>
        </div>
      ) : null}

      {reviewInProgress ? (
        <div className="mt-6 rounded-3xl border border-cyan-400/20 bg-cyan-500/10 p-5">
          <p className="text-xs uppercase tracking-[0.3em] text-cyan-200/90">
            Review claimed
          </p>
          <p className="mt-2 text-sm leading-6 text-cyan-50">
            Claimed by {reviewerName}. Review work is in progress.
          </p>
        </div>
      ) : null}

      <div className="mt-8 grid gap-4 lg:grid-cols-3">
        <div className="rounded-3xl border border-white/10 bg-slate-950/30 p-5">
          <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Vendor</p>
          <p className="mt-3 text-xl font-semibold text-white">{vendor.name}</p>
          <p className="mt-1 text-sm text-slate-400">{vendor.category || "Uncategorized"}</p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-slate-950/30 p-5">
          <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Reviewer</p>
          <p className="mt-3 text-xl font-semibold text-white">{reviewerName}</p>
          <p className="mt-1 text-sm text-slate-400">Updated {formatDate(assignment.updatedAt)}</p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-slate-950/30 p-5">
          <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Request state</p>
          <p className="mt-3 text-xl font-semibold text-white">{request.status || "OPEN"}</p>
          <p className="mt-1 text-sm text-slate-400">Created {formatDate(assignment.createdAt)}</p>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="rounded-3xl border border-cyan-400/15 bg-cyan-500/10 p-5">
          <p className="text-sm text-cyan-100">Evidence files</p>
          <p className="mt-3 text-3xl font-semibold text-white">
            {evidenceSummary.totalEvidence}
          </p>
        </div>

        <div className="rounded-3xl border border-amber-400/15 bg-amber-500/10 p-5">
          <p className="text-sm text-amber-100">Pending evidence requests</p>
          <p className="mt-3 text-3xl font-semibold text-white">
            {evidenceSummary.pendingRequests}
          </p>
        </div>

        <div className="rounded-3xl border border-emerald-400/15 bg-emerald-500/10 p-5">
          <p className="text-sm text-emerald-100">Completed evidence requests</p>
          <p className="mt-3 text-3xl font-semibold text-white">
            {evidenceSummary.completedRequests}
          </p>
        </div>
      </div>


      {!editingLocked ? (
        <div className="mt-6 rounded-3xl border border-cyan-400/20 bg-cyan-500/10 p-6">
          <p className="text-xs uppercase tracking-[0.3em] text-cyan-200/90">
            Evidence remediation
          </p>

          <h4 className="mt-3 text-2xl font-semibold text-white">
            Request remediation evidence
          </h4>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
            Create evidence requests directly from this governance review. Vendors will see the request in their evidence portal, and unresolved evidence can block release readiness.
          </p>

          <div className="mt-5 rounded-2xl border border-white/10 bg-slate-950/40 p-5">
            <EvidenceRequestForm
              vendorId={vendor.id}
              organizationId={vendor.organizationId ?? null}
            />
          </div>
        </div>
      ) : null}

      {!truvernCustomerView ? (
      <div className="mt-6 rounded-3xl border border-white/10 bg-slate-950/30 p-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-cyan-200/90">
              Remediation tracking
            </p>

            <h4 className="mt-3 text-2xl font-semibold text-white">
              Evidence request lifecycle
            </h4>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
              Track remediation requests from vendor response through governance validation. Open requests remain release blockers until resolved.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white">
            Open blockers:{" "}
            <span className="font-semibold text-amber-200">
              {evidenceSummary.openRemediationRequests ?? 0}
            </span>
          </div>
        </div>

        {remediationRequests.length > 0 ? (
          <div className="mt-5 grid gap-3">
            {remediationRequests.map((request) => {
              const status = String(request.status || "REQUESTED").toUpperCase();
              const isResolved = ["RECEIVED", "APPROVED", "COMPLETED", "FULFILLED", "RESOLVED"].includes(status);
              const dueText = request.dueAt
                ? new Date(request.dueAt).toLocaleString()
                : "No due date";
              const updatedText = request.updatedAt
                ? new Date(request.updatedAt).toLocaleString()
                : "Not updated";

              return (
                <div
                  key={request.id}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full border px-3 py-1 text-xs font-semibold tracking-[0.18em] ${remediationChipClass(status)}`}>
                          {status}
                        </span>

                        <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-slate-200">
                          {request.kind}
                        </span>

                        {isResolved ? (
                          <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs text-emerald-100">
                            Release blocker cleared
                          </span>
                        ) : (
                          <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-xs text-amber-100">
                            Blocking release
                          </span>
                        )}
                      </div>

                      <h5 className="mt-3 text-lg font-semibold text-white">
                        {request.title}
                      </h5>

                      <p className="mt-1 text-sm text-slate-400">
                        Request #{request.id} · Due: {dueText} · Updated: {updatedText}
                      </p>
                    </div>

                    <div className="space-y-3 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-slate-200">
                      <div>
                        {isResolved
                          ? "Vendor evidence received. Ready for validation."
                          : "Awaiting vendor remediation response."}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {status !== "APPROVED" ? (
                          <button
                            type="button"
                            onClick={async () => {
                              await fetch(`/api/evidence-requests/${request.id}/review`, {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ action: "APPROVE" }),
                              });

                              window.location.reload();
                            }}
                            className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-500/20"
                          >
                            Approve remediation
                          </button>
                        ) : null}

                        {status !== "REJECTED" ? (
                          <button
                            type="button"
                            onClick={async () => {
                              await fetch(`/api/evidence-requests/${request.id}/review`, {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ action: "REJECT" }),
                              });

                              window.location.reload();
                            }}
                            className="rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-1 text-xs font-semibold text-rose-200 transition hover:bg-rose-500/20"
                          >
                            Reject
                          </button>
                        ) : null}

                        {status === "APPROVED" || status === "REJECTED" ? (
                          <button
                            type="button"
                            onClick={async () => {
                              await fetch(`/api/evidence-requests/${request.id}/review`, {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ action: "REOPEN" }),
                              });

                              window.location.reload();
                            }}
                            className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-500/20"
                          >
                            Reopen
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-sm text-slate-300">
            No remediation requests have been issued for this vendor review yet.
          </div>
        )}
      </div>
      ) : null}
      {isTruvern && showTruvernOperatorControls ? (
        <div className="mt-6 rounded-3xl border border-cyan-400/20 bg-cyan-500/10 p-6">
          <p className="text-xs uppercase tracking-[0.3em] text-cyan-200/90">
            Truvern release gate
          </p>

          <h4 className="mt-3 text-2xl font-semibold text-white">
            {outcomeConfirmed
              ? "Truvern outcome confirmed"
              : awaitingCustomerConfirmation
                ? approvalLanguage(assignment.assignmentType).releasedByGovernance
                : "Awaiting Truvern review"}
          </h4>

          <p className="mt-2 text-sm leading-6 text-slate-300">
            {outcomeConfirmed
              ? "This Truvern outcome is finalized and locked for governance audit history."
              : awaitingCustomerConfirmation
                ? "The Truvern outcome is available for customer confirmation. Editing and reopen actions remain locked."
                : "Truvern can prepare, edit, complete, and release the governance assessment from this workspace."}
          </p>

          <div className="mt-5 grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
  <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4">
    <p className="text-xs uppercase tracking-[0.22em] text-amber-200">
      Residual risk
    </p>

    <p className="mt-3 text-2xl font-semibold text-white">
      {governanceLabel(riskLevel) || "Not set"}
    </p>
  </div>

  <div className="rounded-2xl border border-cyan-400/20 bg-cyan-500/10 p-4">
    <p className="text-xs uppercase tracking-[0.22em] text-cyan-200">
      Governance decision
    </p>

    <p className="mt-3 text-2xl font-semibold text-white">
      {governanceLabel(decision) || "Pending"}
    </p>
  </div>

  <div className="rounded-2xl border border-violet-400/20 bg-violet-500/10 p-4">
    <p className="text-xs uppercase tracking-[0.22em] text-violet-200">
      Release state
    </p>

    <p className="mt-3 text-2xl font-semibold text-white">
      {governanceLabel(releaseState) || "Draft"}
    </p>
  </div>

  <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4">
    <p className="text-xs uppercase tracking-[0.22em] text-emerald-200">
      Review status
    </p>

    <p className="mt-3 text-2xl font-semibold text-white">
      {governanceLabel(displayStatus) || "Open"}
    </p>
  </div>
</div>

<div className="mt-5 grid gap-4 lg:grid-cols-3">
  <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
    <p className="text-xs uppercase tracking-[0.22em] text-slate-400">
      Vendor category
    </p>

    <p className="mt-2 text-sm font-semibold text-white">
      {vendor.category || "Uncategorized"}
    </p>
  </div>

  <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
    <p className="text-xs uppercase tracking-[0.22em] text-slate-400">
      Vendor tier
    </p>

    <p className="mt-2 text-sm font-semibold text-white">
      {String(
        latestOutcome.generatedDraft?.structuredAssessment?.vendorOverview?.tier ||
          latestOutcome.generatedDraft?.structuredAssessment?.vendorOverview?.vendorTier ||
          "Not assigned",
      )}
    </p>
  </div>

  <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
    <p className="text-xs uppercase tracking-[0.22em] text-slate-400">
      Criticality
    </p>

    <p className="mt-2 text-sm font-semibold text-white">
      {String(
        latestOutcome.generatedDraft?.structuredAssessment?.vendorOverview?.criticality ||
          "Not specified",
      )}
    </p>
  </div>
</div>

          <div className="mt-5 space-y-5">
            <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-5">
              <label className="text-xs uppercase tracking-[0.25em] text-violet-200">
                Executive summary
              </label>
              <textarea
                disabled={editingLocked}
                value={executiveSummary}
                onChange={(e) => setExecutiveSummary(e.target.value)}
                rows={5}
                className="mt-3 w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm leading-6 text-white disabled:cursor-not-allowed disabled:opacity-70"
              />
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-5">
              <label className="text-xs uppercase tracking-[0.25em] text-violet-200">
                Final assessment
              </label>
              <textarea
                disabled={editingLocked}
                value={finalAssessment}
                onChange={(e) => setFinalAssessment(e.target.value)}
                rows={10}
                className="mt-3 w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm leading-6 text-white disabled:cursor-not-allowed disabled:opacity-70"
              />
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-5">
              <label className="text-xs uppercase tracking-[0.25em] text-violet-200">
                Conditions & follow-ups
              </label>
              <textarea
                disabled={editingLocked}
                value={recommendationsText}
                onChange={(e) => setRecommendationsText(e.target.value)}
                rows={6}
                className="mt-3 w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm leading-6 text-white disabled:cursor-not-allowed disabled:opacity-70"
              />
            </div>


          </div>

          {!editingLocked ? (
            <div
              className={`mt-5 rounded-2xl border p-4 text-sm ${
                Boolean(evidenceSummary.releaseBlocked && (evidenceSummary.openRemediationRequests ?? 0) > 0)
                  ? "border-amber-500/40 bg-amber-500/10 text-amber-100"
                  : "border-amber-400/20 bg-amber-500/10 text-amber-50"
              }`}
            >
              {Boolean(evidenceSummary.releaseBlocked && (evidenceSummary.openRemediationRequests ?? 0) > 0)
                ? `Release blocked: ${evidenceSummary.openRemediationRequests ?? 0} unresolved remediation request${
                    (evidenceSummary.openRemediationRequests ?? 0) === 1 ? "" : "s"
                  } must be resolved before governance release.`
                : "Release readiness requires executive summary, final assessment, conditions, risk level, and governance decision before completion or release."}
            </div>
          ) : null}

          {!editingLocked ? (
            <div className="mt-5 flex flex-wrap gap-3">
              {canGenerateTruvernDraft ? (
                <button
                  type="button"
                  disabled={generatingDraft || saving}
                  onClick={generateDraft}
                  className="rounded-2xl border border-violet-300/20 bg-violet-400/10 px-5 py-3 text-sm font-semibold text-violet-50 hover:bg-violet-400/15 disabled:opacity-50"
                >
                  {generatingDraft ? "Generating assessment..." : "Generate assessment"}
                </button>
              ) : null}

              <button
                type="button"
                disabled={saving}
                onClick={() => {
                  if (editingLocked) return;
                  submitOutcome("SAVE_DRAFT");
                }}
                className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm font-medium text-white hover:bg-white/[0.1] disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save assessment"}
              </button>

              <button
                type="button"
                disabled={saving}
                onClick={() => {
                  if (editingLocked) return;
                  submitOutcome("COMPLETE");
                }}
                className="rounded-2xl border border-emerald-300/20 bg-emerald-400/10 px-4 py-3 text-sm font-medium text-emerald-50 hover:bg-emerald-400/15 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Mark complete"}
              </button>

              <button
                type="button"
                disabled={editingLocked || saving || Boolean(evidenceSummary.releaseBlocked && (evidenceSummary.openRemediationRequests ?? 0) > 0)}
                title={Boolean(evidenceSummary.releaseBlocked && (evidenceSummary.openRemediationRequests ?? 0) > 0) ? "Resolve remediation evidence before release" : "Release outcome"}
                onClick={() => {
                  if (Boolean(evidenceSummary.releaseBlocked && (evidenceSummary.openRemediationRequests ?? 0) > 0)) {
                    setMessage("Resolve all remediation evidence requests before governance release.");
                    return;
                  }

                  setShowReleasePreview(true);
                }}
                className="rounded-2xl border border-cyan-300/20 bg-cyan-400/10 px-4 py-3 text-sm font-medium text-cyan-50 hover:bg-cyan-400/15 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {saving ? "Saving..." : "Release outcome"}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
      {!truvernCustomerView ? (
            <div className="mt-6 rounded-3xl border border-cyan-400/20 bg-cyan-500/10 p-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-cyan-200/90">
              Vendor submitted responses
            </p>
            <h4 className="mt-3 text-2xl font-semibold text-white">
              Questionnaire answers
            </h4>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white">
            Answers: <span className="font-semibold text-cyan-200">{vendorAnswers.length}</span>
          </div>
        </div>

        {!truvernCustomerView && vendorAnswers.length > 0 ? (
          <div className="mt-5 grid gap-3">
            {vendorAnswers.map((answer) => (
              <div key={`${answer.assessmentId}-${answer.questionId}`} className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                  Control {answer.questionType || "Question"} · Question #{answer.questionId}
                </p>
                <h5 className="mt-2 text-sm font-semibold leading-6 text-white">{answer.prompt}</h5>
                <p className="mt-3 rounded-xl border border-cyan-400/15 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-50">
                  {answer.value
                    ? answer.value.replaceAll("_", " ").toUpperCase()
                    : "No answer recorded"}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-sm text-slate-300">
            No submitted questionnaire answers were found for this review.
          </div>
        )}

      </div>
      ) : null}
      <div className="mt-6 rounded-3xl border border-white/10 bg-slate-950/30 p-6">
          <p className="text-xs uppercase tracking-[0.3em] text-cyan-200/90">
            Findings and outcome
          </p>

          {latestOutcome.updatedAt ? (
            <p className="mt-2 text-sm text-slate-400">
              Last saved {formatDate(latestOutcome.updatedAt)}
            </p>
          ) : null}

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-slate-200">Risk level</label>
              <select
                disabled={editingLocked}
                value={riskLevel}
                onChange={(e) => setRiskLevel(e.target.value)}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none disabled:cursor-not-allowed disabled:opacity-70"
              >
                <option value="">Select risk level</option>
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">Critical</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-200">Decision</label>
              <select
                disabled={editingLocked}
                value={decision}
                onChange={(e) => setDecision(e.target.value)}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none disabled:cursor-not-allowed disabled:opacity-70"
              >
                <option value="">Select decision</option>
                <option value="APPROVE">Approve</option>
                <option value="APPROVE_WITH_CONDITIONS">Approve with conditions</option>
                <option value="REJECT">Reject</option>
                <option value="ESCALATE">Escalate</option>
              </select>
            </div>
          </div>

          <div className="mt-5 space-y-5">
            <div>
              <label className="text-sm font-medium text-slate-200">Review findings</label>
              <textarea
                disabled={editingLocked}
                rows={7}
                value={findings}
                onChange={(e) => setFindings(e.target.value)}
                placeholder="Document key evidence reviewed, material risks, compensating controls, and recommended decision."
                className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm leading-6 text-white outline-none placeholder:text-slate-500 disabled:cursor-not-allowed disabled:opacity-70"
              />
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-slate-200">Executive summary</label>
                <textarea
                  disabled={editingLocked}
                  rows={8}
                  value={executiveSummary}
                  onChange={(e) => setExecutiveSummary(e.target.value)}
                  placeholder="Provide board-level governance summary, evidence reviewed, residual risk, and reviewer conclusion."
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm leading-6 text-white outline-none placeholder:text-slate-500 disabled:cursor-not-allowed disabled:opacity-70"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-200">Final assessment</label>
                <textarea
                  disabled={editingLocked}
                  rows={8}
                  value={finalAssessment}
                  onChange={(e) => setFinalAssessment(e.target.value)}
                  placeholder="Document control gaps, compensating controls, remediation status, release conditions, and final recommendation."
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm leading-6 text-white outline-none placeholder:text-slate-500 disabled:cursor-not-allowed disabled:opacity-70"
                />
              </div>
            </div>
          </div>

          {!editingLocked ? (
            <div
              className={`mt-5 rounded-2xl border p-4 text-sm ${
                Boolean(evidenceSummary.releaseBlocked && (evidenceSummary.openRemediationRequests ?? 0) > 0)
                  ? "border-amber-500/40 bg-amber-500/10 text-amber-100"
                  : "border-amber-400/20 bg-amber-500/10 text-amber-50"
              }`}
            >
              {Boolean(evidenceSummary.releaseBlocked && (evidenceSummary.openRemediationRequests ?? 0) > 0)
                ? `Release blocked: ${evidenceSummary.openRemediationRequests ?? 0} unresolved remediation request${
                    (evidenceSummary.openRemediationRequests ?? 0) === 1 ? "" : "s"
                  } must be resolved before governance release.`
                : "Release readiness requires executive summary, final assessment, conditions, risk level, and governance decision before completion or release."}
            </div>
          ) : null}

          {!editingLocked ? (
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                disabled={saving}
                onClick={() => {
                  if (editingLocked) return;
                  submitOutcome("SAVE_DRAFT");
                }}
                className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm font-medium text-white hover:bg-white/[0.1] disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save draft"}
              </button>

              <button
                type="button"
                disabled={saving}
                onClick={() => {
                  if (editingLocked) return;
                  submitOutcome("COMPLETE");
                }}
                className="rounded-2xl border border-emerald-300/20 bg-emerald-400/10 px-4 py-3 text-sm font-medium text-emerald-50 hover:bg-emerald-400/15 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Mark complete"}
              </button>

              <button
                type="button"
                disabled={editingLocked || saving || Boolean(evidenceSummary.releaseBlocked && (evidenceSummary.openRemediationRequests ?? 0) > 0)}
                title={Boolean(evidenceSummary.releaseBlocked && (evidenceSummary.openRemediationRequests ?? 0) > 0) ? "Resolve remediation evidence before release" : "Release outcome"}
                onClick={() => {
                  if (Boolean(evidenceSummary.releaseBlocked && (evidenceSummary.openRemediationRequests ?? 0) > 0)) {
                    setMessage("Resolve all remediation evidence requests before governance release.");
                    return;
                  }

                  setShowReleasePreview(true);
                }}
                className="rounded-2xl border border-cyan-300/20 bg-cyan-400/10 px-4 py-3 text-sm font-medium text-cyan-50 hover:bg-cyan-400/15 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {saving ? "Saving..." : "Release outcome"}
              </button>
            </div>
          ) : (
            <>
              <div className="mt-5 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-4 text-sm text-emerald-50">
                This governance review is managed internally by Truvern. Assessment results, remediation handling, and governance release activity are controlled by the Truvern review team.
              </div>

              {canManageTruvernReview ? (
                <div className="mt-5 rounded-2xl border border-amber-400/20 bg-amber-500/10 p-5">
                  <p className="text-xs uppercase tracking-[0.22em] text-amber-200">
                    Truvern operator override
                  </p>

                  <p className="mt-2 text-sm leading-6 text-amber-50/90">
                    Unlocking a released or confirmed outcome preserves prior release history and records this action as an operator override.
                  </p>

                  <textarea
                    value={unlockReason}
                    onChange={(event) => setUnlockReason(event.target.value)}
                    rows={3}
                    placeholder="Reason for unlocking editing..."
                    className="mt-4 w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-amber-300/50"
                  />

                  <label className="mt-4 flex items-start gap-3 text-sm text-amber-50">
                    <input
                      type="checkbox"
                      checked={acceptedUnlockOverride}
                      onChange={(event) => setAcceptedUnlockOverride(event.target.checked)}
                      className="mt-1 h-4 w-4 rounded border-white/20 bg-slate-950 text-amber-400"
                    />

                    <span className="leading-6">
                      I acknowledge I am unlocking a released or confirmed governance outcome as an authorized Truvern operator and that this override will be preserved in the audit history.
                    </span>
                  </label>

                  <button
                    type="button"
                    disabled={unlockingEditing || !acceptedUnlockOverride || unlockReason.trim().length < 8}
                    onClick={unlockEditing}
                    className="mt-4 rounded-2xl border border-amber-300/30 bg-amber-400/10 px-5 py-3 text-sm font-semibold text-amber-50 transition hover:bg-amber-400/15 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {unlockingEditing ? "Unlocking..." : "Unlock editing"}
                  </button>
                </div>
              ) : null}
            </>
          )}
        </div>


       {outcomeConfirmed ? (
  <div className="mt-6 rounded-3xl border border-emerald-400/20 bg-gradient-to-br from-emerald-500/10 via-cyan-500/10 to-slate-950/40 p-8">
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
      <div>
        <p className="text-xs uppercase tracking-[0.35em] text-emerald-200">
          Final Truvern Governance Seal
        </p>

        <h3 className="mt-4 text-3xl font-semibold text-white">
          Governance assessment finalized
        </h3>

        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
          This governance assessment has completed Truvern review,
          release approval, customer confirmation, and audit finalization.
          The finalized governance outcome is now immutable.
        </p>
      </div>

      <div className="rounded-3xl border border-emerald-300/20 bg-emerald-400/10 px-6 py-5">
        <p className="text-xs uppercase tracking-[0.28em] text-emerald-100">
          Finalized status
        </p>

        <p className="mt-3 text-3xl font-semibold text-white">
          {assignment.assignmentType === "INTERNAL" ? "APPROVED" : "CONFIRMED"}
        </p>

        <Link
  href={`/review-desk/reviews/${assignment.id}/packet`}
  className="mt-5 inline-flex rounded-2xl border border-emerald-300/25 bg-emerald-300/10 px-4 py-3 text-sm font-semibold text-emerald-50 hover:bg-emerald-300/15"
>
  Export governance packet archive
</Link>
      </div>
    </div>

    <div className="mt-8 grid gap-4 lg:grid-cols-4">
      <div className="min-h-[170px] rounded-2xl border border-white/10 bg-slate-950/70 p-5">
        <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
          Released by
        </p>

        <p className="mt-3 text-sm font-semibold text-white">
          {reviewerName || "Truvern governance"}
        </p>
      </div>

      <div className="min-h-[170px] rounded-2xl border border-white/10 bg-slate-950/70 p-5">
        <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
          Finalized at
        </p>

        <p className="mt-3 text-sm font-semibold text-white">
          {formatDate(latestOutcome.updatedAt)}
        </p>
      </div>

      <div className="min-h-[170px] rounded-2xl border border-white/10 bg-slate-950/70 p-5">
        <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
          Governance version
        </p>

        <p className="mt-3 text-sm font-semibold text-white">
          {latestOutcome.governanceVersion || "TRV-GOV-1.0"}
        </p>
      </div>

      <div className="min-h-[170px] rounded-2xl border border-white/10 bg-slate-950/70 p-5">
        <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
          Assessment scope
        </p>

        <p className="mt-3 text-sm font-semibold text-white">
          Vendor governance review
        </p>
      </div>
    </div>

    {latestOutcome.manifestId ? (
      <div className="mt-6 rounded-3xl border border-violet-400/20 bg-violet-500/10 p-6">
        <p className="text-xs uppercase tracking-[0.35em] text-violet-200">
          Governance Manifest
        </p>

        <h4 className="mt-3 text-2xl font-semibold text-white">
          Machine-verifiable release record
        </h4>

        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-400">
              Manifest ID
            </p>
            <p className="mt-2 text-sm font-semibold text-white">
              #{latestOutcome.manifestId}
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-400">
              Manifest version
            </p>
            <p className="mt-2 text-sm font-semibold text-white">
              {latestOutcome.manifestVersion || "GRM-1.0"}
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-400">
              Governance version
            </p>
            <p className="mt-2 text-sm font-semibold text-white">
              {latestOutcome.governanceVersion || "TRV-GOV-1.0"}
            </p>
          </div>
        </div>

        {latestOutcome.manifestChecksum ? (
          <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-400">
              Manifest checksum
            </p>
            <p className="mt-2 break-all font-mono text-xs text-violet-100">
              {latestOutcome.manifestChecksum}
            </p>
          </div>
        ) : null}

        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href={`/api/governance/manifests/${latestOutcome.manifestId}`}
            target="_blank"
            className="rounded-2xl border border-violet-300/25 bg-violet-300/10 px-4 py-3 text-sm font-semibold text-violet-50 hover:bg-violet-300/15"
          >
            Export manifest JSON
          </Link>

          <Link
            href={`/api/governance/verify/${latestOutcome.manifestId}`}
            target="_blank"
            className="rounded-2xl border border-emerald-300/25 bg-emerald-300/10 px-4 py-3 text-sm font-semibold text-emerald-50 hover:bg-emerald-300/15"
          >
            Verify manifest
          </Link>
        </div>
      </div>
    ) : null}
  </div>
) : null}
<div className="mt-6 rounded-3xl border border-white/10 bg-slate-950/30 p-6">
        <p className="text-xs uppercase tracking-[0.3em] text-cyan-200/90">
          Audit timeline
        </p>

        <div className="mt-5 space-y-4">
          {auditEvents.map((event, index) => {
            const done = Boolean(event.at);

            return (
              <div
                key={`${event.label}-${index}`}
                className="flex gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4"
              >
                <div
                  className={
                    done
                      ? "mt-1 h-3 w-3 rounded-full bg-emerald-300"
                      : "mt-1 h-3 w-3 rounded-full bg-slate-600"
                  }
                />

                <div>
                  <p className="text-sm font-semibold text-white">{event.label}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    {done ? formatDate(event.at) : "Pending"}
                  </p>
                  <p className="mt-2 text-sm text-slate-300">{event.detail}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
  
      {showReleasePreview ? (
        <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-3xl border border-cyan-400/20 bg-[#041426] p-8 shadow-2xl shadow-black/50">
            <div className="flex items-start justify-between gap-6">
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-cyan-200">
                  Release Preview
                </p>

                <h3 className="mt-3 text-3xl font-semibold text-white">
                  Immutable governance release
                </h3>

                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
                  Confirm the governance outcome before release. Editing locks after release and customer confirmation finalizes the governance record.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowReleasePreview(false)}
                className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-2 text-sm text-white hover:bg-white/[0.1]"
              >
                Close
              </button>
            </div>

            <div className="mt-8 grid gap-4 lg:grid-cols-2">
              <div className="min-h-[170px] rounded-2xl border border-white/10 bg-slate-950/70 p-5">
                <p className="text-xs uppercase tracking-[0.22em] text-slate-400">
                  Governance decision
                </p>

                <p className="mt-3 text-lg font-semibold text-white">
                  {governanceLabel(decision) || "Pending"}
                </p>
              </div>

              <div className="min-h-[170px] rounded-2xl border border-white/10 bg-slate-950/70 p-5">
                <p className="text-xs uppercase tracking-[0.22em] text-slate-400">
                  Residual risk
                </p>

                <p className="mt-3 text-lg font-semibold text-white">
                  {governanceLabel(riskLevel) || "Medium"}
                </p>
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-5">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-400">
                Executive summary
              </p>

              <div className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-200">
                {executiveSummary || "No executive summary provided."}
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-5">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-400">
                Final assessment
              </p>

              <div className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-200">
                {finalAssessment || "No final assessment provided."}
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-amber-400/20 bg-amber-500/10 p-5">
              <p className="text-xs uppercase tracking-[0.22em] text-amber-200">
                Immutable governance warning
              </p>

              <ul className="mt-4 space-y-2 text-sm leading-6 text-amber-50">
                <li>• Editing locks after governance release.</li>
                <li>• Customer confirmation finalizes the governance artifact.</li>
                <li>• Governance manifests and checksums become audit records.</li>
                <li>• Reserved Truvern credits are consumed on confirmation.</li>
              </ul>
            </div>

            <label className="mt-6 flex items-start gap-3 rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4 text-sm text-slate-200">
              <input
                type="checkbox"
                checked={acceptedAcknowledgement}
                onChange={(event) => setAcceptedAcknowledgement(event.target.checked)}
                className="mt-1 h-4 w-4 rounded border-white/20 bg-slate-950 text-cyan-400"
              />

              <span className="leading-6">
                {isTruvern
                  ? "I acknowledge that Truvern governance outcomes are operational governance assessments and not legal guarantees, certifications, warranties, or regulatory attestations. Final governance responsibility remains with my organization."
                  : "I acknowledge I am approving or finalizing this governance outcome as an authorized Truvern operator on behalf of this workspace."}
              </span>
            </label>
            <div className="sticky bottom-0 -mx-8 mt-8 flex flex-wrap gap-3 border-t border-white/10 bg-[#041426]/95 px-8 py-5 backdrop-blur">
              <button
                type="button"
                disabled={saving}
                onClick={() => setShowReleasePreview(false)}
                className="rounded-2xl border border-white/10 bg-white/[0.06] px-5 py-3 text-sm font-medium text-white hover:bg-white/[0.1]"
              >
                Continue editing
              </button>

              <button
                type="button"
                disabled={editingLocked || saving || Boolean(evidenceSummary.releaseBlocked && (evidenceSummary.openRemediationRequests ?? 0) > 0)}
                title={Boolean(evidenceSummary.releaseBlocked && (evidenceSummary.openRemediationRequests ?? 0) > 0) ? "Resolve remediation evidence before release" : "Confirm release"}
                onClick={async () => {
                  if (Boolean(evidenceSummary.releaseBlocked && (evidenceSummary.openRemediationRequests ?? 0) > 0)) {
                    setMessage("Resolve all remediation evidence requests before governance release.");
                    setShowReleasePreview(false);
                    return;
                  }

                  setShowReleasePreview(false);
                  await submitOutcome("RELEASE");
                }}
                className="rounded-2xl border border-cyan-300/20 bg-cyan-400/10 px-5 py-3 text-sm font-semibold text-cyan-50 hover:bg-cyan-400/15 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {saving ? "Releasing..." : "Confirm release"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

  </section>
    </>
  );
}
















































































































function CreditMiniCard({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div
      className={
        accent
          ? "rounded-2xl border border-cyan-300/20 bg-cyan-400/10 p-4"
          : "rounded-2xl border border-white/10 bg-black/20 p-4"
      }
    >
      <p className={accent ? "text-xs uppercase tracking-[0.2em] text-cyan-200" : "text-xs uppercase tracking-[0.2em] text-slate-400"}>
        {label}
      </p>

      <p className="mt-2 text-2xl font-semibold text-white">
        {value}
      </p>
    </div>
  );
}



















