import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { generateFindings, type TruvernGeneratedFinding } from "@/lib/governance/findings-engine";
import type { TruvernScoringInput } from "@/lib/governance/scoring-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteContext = {
  params: Promise<{ id: string }>;
};

type ReviewResponseRow = {
  id: number;
  responses: unknown;
};

function parseId(value: unknown) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function safeObject(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, any>)
    : {};
}

function safeText(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeResponses(responses: any[]): TruvernScoringInput[] {
  return responses.map((response) => ({
    questionId: response.questionId,
    controlId: response.question.control.id,
    controlCode: response.question.control.controlId,
    family: response.question.control.family,
    prompt: response.question.prompt,
    answer: response.answer,
    score: response.score,
    maxScore: response.question.weight ?? 1,
    weight: response.question.weight ?? 1,
    requiresEvidence: response.question.requiresEvidence,
    requiresAttestation: response.question.requiresAttestation,
    evidence: response.evidence,
  }));
}

function toSeverity(severity: TruvernGeneratedFinding["severity"]) {
  if (severity === "CRITICAL") return "CRITICAL";
  if (severity === "HIGH") return "HIGH";
  if (severity === "MODERATE") return "MODERATE";
  if (severity === "LOW") return "LOW";
  return "INFO";
}

function decisionForRisk(riskLevel: string | null | undefined, blocked: boolean) {
  const level = String(riskLevel ?? "").toUpperCase();

  if (level === "CRITICAL") return "REJECT_OR_ESCALATE";
  if (blocked) return "APPROVE_WITH_REMEDIATION";
  if (level === "HIGH") return "APPROVE_WITH_CONDITIONS";
  return "APPROVE";
}

type FallbackFinding = {
  id: string;
  severity: string;
  title: string;
  description: string;
  recommendation: string;
  remediationRequired: boolean;
  attestationRequired: boolean;
  dueAt: string | null;
};

function controlTagForFinding(id: string, title: string, description: string) {
  const idText = `${id}`.toLowerCase();
  const titleText = `${title}`.toLowerCase();
  const bodyText = `${description}`.toLowerCase();

  if (
    titleText.includes("risk assessment") ||
    titleText.includes("vendor governance") ||
    idText.includes("risk") ||
    idText.includes("vendor")
  ) {
    return {
      control: "RA-3 / CA-7 / SR-6",
      controlFamily: "Risk Assessment / Security Assessment / Supply Chain Risk Management",
      controlName: "Risk Assessment, Continuous Monitoring, and Supplier Reviews",
    };
  }

  if (
    titleText.includes("audit") ||
    titleText.includes("logging") ||
    titleText.includes("monitoring") ||
    idText.includes("audit") ||
    idText.includes("logging")
  ) {
    return {
      control: "AU-6 / AU-12",
      controlFamily: "Audit and Accountability",
      controlName: "Audit Review, Analysis, Reporting, and Record Generation",
    };
  }

  if (
    titleText.includes("incident") ||
    titleText.includes("response plan") ||
    idText.includes("incident")
  ) {
    return {
      control: "IR-4 / IR-8",
      controlFamily: "Incident Response",
      controlName: "Incident Handling and Incident Response Plan",
    };
  }

  if (
    titleText.includes("implementation") ||
    titleText.includes("control gap") ||
    titleText.includes("missing evidence") ||
    titleText.includes("unverified") ||
    idText.includes("implementation") ||
    idText.includes("gap")
  ) {
    return {
      control: "CM-3 / SI-2 / CA-2",
      controlFamily: "Configuration Management / System and Information Integrity / Security Assessment",
      controlName: "Configuration Change Control, Flaw Remediation, and Control Assessment",
    };
  }

  if (
    titleText.includes("access") ||
    titleText.includes("account") ||
    titleText.includes("privileged") ||
    titleText.includes("mfa") ||
    idText.includes("access")
  ) {
    return {
      control: "AC-2 / IA-2",
      controlFamily: "Access Control / Identification and Authentication",
      controlName: "Account Management and Multi-Factor Authentication",
    };
  }

  if (
    titleText.includes("configuration") ||
    titleText.includes("change") ||
    titleText.includes("patch") ||
    titleText.includes("baseline") ||
    idText.includes("configuration")
  ) {
    return {
      control: "CM-2 / CM-3 / SI-2",
      controlFamily: "Configuration Management / System and Information Integrity",
      controlName: "Baseline Configuration, Configuration Change Control, and Flaw Remediation",
    };
  }

  if (
    titleText.includes("network") ||
    titleText.includes("encryption") ||
    titleText.includes("firewall") ||
    titleText.includes("segmentation") ||
    idText.includes("network")
  ) {
    return {
      control: "SC-7 / SC-13",
      controlFamily: "System and Communications Protection",
      controlName: "Boundary Protection and Cryptographic Protection",
    };
  }

  if (
    bodyText.includes("access control") ||
    bodyText.includes("privileged access") ||
    bodyText.includes("mfa")
  ) {
    return {
      control: "AC-2 / IA-2",
      controlFamily: "Access Control / Identification and Authentication",
      controlName: "Account Management and Multi-Factor Authentication",
    };
  }

  return {
    control: "CA-7 / RA-3",
    controlFamily: "Security Assessment and Risk Assessment",
    controlName: "Continuous Monitoring and Risk Assessment",
  };
}

function governanceEvidencePackForFinding(finding: any) {
  const joined = [
    finding?.id,
    finding?.title,
    finding?.description,
    finding?.recommendation,
    finding?.control,
    finding?.controlCode,
    finding?.controlFamily,
  ]
    .map((value) => String(value ?? "").toLowerCase())
    .join(" ");

  const requiredEvidence: string[] = [];
  const requiredAttestation: string[] = [];

  const addEvidence = (item: string) => {
    if (item && !requiredEvidence.includes(item)) requiredEvidence.push(item);
  };

  const addAttestation = (item: string) => {
    if (item && !requiredAttestation.includes(item)) requiredAttestation.push(item);
  };

  if (
    joined.includes("access") ||
    joined.includes("identity") ||
    joined.includes("authentication") ||
    joined.includes("ac-2") ||
    joined.includes("ia-2")
  ) {
    addEvidence("MFA policy and enforcement evidence");
    addEvidence("User provisioning and deprovisioning procedure");
    addEvidence("Latest access review report");
    addEvidence("Privileged access approval evidence");
    addAttestation("Security officer attestation for access control implementation");
  }

  if (
    joined.includes("incident") ||
    joined.includes("response") ||
    joined.includes("ir-4") ||
    joined.includes("ir-8")
  ) {
    addEvidence("Incident response plan");
    addEvidence("Incident escalation and notification procedure");
    addEvidence("Tabletop exercise or incident response test evidence");
    addEvidence("Recent incident response record or test results");
    addAttestation("Incident response owner attestation");
  }

  if (
    joined.includes("audit") ||
    joined.includes("logging") ||
    joined.includes("monitoring") ||
    joined.includes("au-6") ||
    joined.includes("au-12")
  ) {
    addEvidence("Audit logging standard");
    addEvidence("SIEM or monitoring configuration evidence");
    addEvidence("Log review procedure");
    addEvidence("Log retention policy");
    addEvidence("Sample alert review or monitoring screenshot");
    addAttestation("Audit logging control owner attestation");
  }

  if (
    joined.includes("configuration") ||
    joined.includes("change") ||
    joined.includes("vulnerability") ||
    joined.includes("patch") ||
    joined.includes("cm-2") ||
    joined.includes("cm-3") ||
    joined.includes("si-2") ||
    joined.includes("ca-2")
  ) {
    addEvidence("Configuration baseline");
    addEvidence("Change management policy");
    addEvidence("Recent change approval record");
    addEvidence("Vulnerability scan or patch remediation report");
    addEvidence("Remediation ticket evidence");
    addAttestation("Configuration and vulnerability management owner attestation");
  }

  if (
    joined.includes("risk") ||
    joined.includes("supplier") ||
    joined.includes("vendor") ||
    joined.includes("ra-3") ||
    joined.includes("ca-7") ||
    joined.includes("sr-6")
  ) {
    addEvidence("Risk assessment methodology");
    addEvidence("Current risk register");
    addEvidence("Vendor or supplier review evidence");
    addEvidence("Continuous monitoring report");
    addAttestation("Risk owner attestation");
  }

  if (requiredEvidence.length === 0) {
    addEvidence("Relevant policy or procedure for the impacted control");
    addEvidence("Control implementation evidence");
    addEvidence("Remediation plan or compensating control evidence");
  }

  if (requiredAttestation.length === 0 && finding?.attestationRequired) {
    addAttestation("Control owner attestation");
  }

  return { requiredEvidence, requiredAttestation };
}

function enrichRemediationPlans(plans: any[], findings: any[]) {
  const sourcePlans =
    Array.isArray(plans) && plans.length > 0
      ? plans
      : (Array.isArray(findings) ? findings : []).map((finding) => ({
          id: String(finding?.id ?? finding?.title ?? crypto.randomUUID()),
          findingId: String(finding?.id ?? finding?.title ?? ""),
          title: finding?.title ?? "Governance remediation requirement",
          status: "OPEN",
          dueAt: finding?.dueAt ?? null,
        }));

  return sourcePlans.map((plan) => {
    const matchedFinding =
      (Array.isArray(findings) ? findings : []).find((finding) => {
        const findingId = safeText(finding?.id);
        const planFindingId = safeText(plan?.findingId ?? plan?.id);
        const findingTitle = safeText(finding?.title);
        const planTitle = safeText(plan?.title);

        return (
          (findingId && planFindingId && findingId === planFindingId) ||
          (findingTitle && planTitle && (findingTitle.includes(planTitle) || planTitle.includes(findingTitle)))
        );
      }) ?? plan;

    const pack = governanceEvidencePackForFinding(matchedFinding);

    return {
      ...plan,
      status: plan?.status ?? "OPEN",
      blockerStatus: plan?.blockerStatus ?? "OPEN",
      evidenceStatus: plan?.evidenceStatus ?? "REQUESTED",
      requiredEvidence:
        Array.isArray(plan?.requiredEvidence) && plan.requiredEvidence.length > 0
          ? plan.requiredEvidence
          : pack.requiredEvidence,
      requiredAttestation:
        Array.isArray(plan?.requiredAttestation) && plan.requiredAttestation.length > 0
          ? plan.requiredAttestation
          : pack.requiredAttestation,
    };
  });
}

function fallbackFindingsFromResponses(responses: Record<string, any>, vendorName: string): FallbackFinding[] {
  const joined = JSON.stringify(responses).toLowerCase();
  const dueAt = () => new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

  const findings: FallbackFinding[] = [];

  const add = (
    id: string,
    severity: string,
    title: string,
    description: string,
    recommendation: string,
    remediationRequired = true,
    attestationRequired = false,
  ) => {
    const control = controlTagForFinding(id, title, description);
    const controlTitle = `${control.control} ${title}`;
    const controlDescription = [
      `Control family: ${control.controlFamily}.`,
      `Control objective: ${control.controlName}.`,
      description,
    ].join(" ");

    findings.push({
      id,
      severity,
      title: controlTitle,
      description: controlDescription,
      recommendation,
      remediationRequired,
      attestationRequired,
      dueAt: remediationRequired || attestationRequired ? dueAt() : null,
    });
  };

  if (joined.includes("access") || joined.includes("privileged") || joined.includes("account") || joined.includes("mfa")) {
    add(
      "ac-access-governance",
      "HIGH",
      "Access Control Governance Gap",
      "Submitted responses indicate access control, account lifecycle, privileged access, or MFA governance requires reviewer validation.",
      "Provide user access review evidence, privileged access control procedures, MFA enforcement evidence, and account lifecycle documentation.",
      true,
      true,
    );
  }

  if (joined.includes("incident") || joined.includes("breach") || joined.includes("tabletop") || joined.includes("response plan")) {
    add(
      "ir-incident-response",
      "MEDIUM",
      "Incident Response Evidence Gap",
      "Incident response governance could not be fully validated from the submitted response payload.",
      "Provide incident response plan, tabletop exercise evidence, escalation procedures, and recent incident response testing records.",
      true,
      false,
    );
  }

  if (joined.includes("audit") || joined.includes("log") || joined.includes("monitor") || joined.includes("siem")) {
    add(
      "au-audit-logging",
      "MEDIUM",
      "Audit Logging and Monitoring Validation Required",
      "Audit logging, monitoring, or alert review controls require evidence validation before release.",
      "Provide logging standards, SIEM or monitoring evidence, alert review procedures, and retention policy documentation.",
      true,
      false,
    );
  }

  if (joined.includes("configuration") || joined.includes("change") || joined.includes("patch") || joined.includes("baseline")) {
    add(
      "cm-configuration-management",
      "MEDIUM",
      "Configuration and Change Management Evidence Gap",
      "Configuration baseline, change approval, or patch governance controls require supporting evidence.",
      "Provide change management records, configuration baseline evidence, patching reports, and approval workflow documentation.",
      true,
      false,
    );
  }

  if (joined.includes("risk") || joined.includes("assessment") || joined.includes("vendor") || joined.includes("third party")) {
    add(
      "ra-risk-assessment",
      "MEDIUM",
      "Risk Assessment Governance Validation Required",
      "Risk assessment and vendor governance responses require reviewer confirmation before final governance release.",
      "Provide risk assessment methodology, vendor risk review evidence, and most recent risk register or governance review record.",
      false,
      false,
    );
  }

  if (joined.includes("encryption") || joined.includes("network") || joined.includes("segmentation") || joined.includes("firewall")) {
    add(
      "sc-system-communications",
      "HIGH",
      "System and Communications Protection Evidence Gap",
      "Network protection, encryption, segmentation, or boundary protection controls require evidence validation.",
      "Provide encryption standards, network segmentation diagrams, firewall or boundary control evidence, and secure transmission documentation.",
      true,
      true,
    );
  }

  if (joined.includes("missing") || joined.includes("partial") || joined.includes("gap") || joined.includes("not implemented") || joined.includes("no")) {
    add(
      "general-control-gap",
      "HIGH",
      "Control Implementation Gap",
      "Submitted responses indicate incomplete implementation, missing evidence, or unverified governance controls.",
      "Submit remediation evidence, compensating controls, owner attestation, or updated supporting documentation before release.",
      true,
      true,
    );
  }

  if (findings.length === 0) {
    add(
      "governance-review-validation",
      "LOW",
      "Governance Review Validation Required",
      `${vendorName} completed a Truvern governance review. No automatic control blocker was detected from the available response payload.`,
      "Reviewer should validate evidence posture, response completeness, and release conditions before approval.",
      false,
      false,
    );
  }

  return findings;
}

function remediationRequiredEvidence(finding: FallbackFinding) {
  const text = `${finding.id} ${finding.title} ${finding.description} ${finding.recommendation}`.toLowerCase();

  if (text.includes("access") || text.includes("account") || text.includes("privileged") || text.includes("mfa")) {
    return [
      "User access review report",
      "Privileged access control procedure",
      "MFA enforcement evidence",
      "Account lifecycle documentation",
    ];
  }

  if (text.includes("incident") || text.includes("breach") || text.includes("response")) {
    return [
      "Incident response plan",
      "Tabletop exercise evidence",
      "Escalation procedure",
      "Incident response testing record",
    ];
  }

  if (text.includes("audit") || text.includes("log") || text.includes("monitor")) {
    return [
      "Logging standard",
      "Monitoring evidence",
      "Alert review procedure",
      "Retention policy documentation",
    ];
  }

  if (text.includes("configuration") || text.includes("change") || text.includes("patch")) {
    return [
      "Change management record",
      "Configuration baseline evidence",
      "Patch report",
      "Approval workflow documentation",
    ];
  }

  if (text.includes("network") || text.includes("encryption") || text.includes("firewall") || text.includes("segmentation")) {
    return [
      "Encryption standard",
      "Network segmentation diagram",
      "Firewall or boundary control evidence",
      "Secure transmission documentation",
    ];
  }

  return [
    "Supporting control evidence",
    "Updated policy or procedure",
    "Compensating control documentation",
  ];
}

function buildRemediationPlans(findings: FallbackFinding[]) {
  return findings
    .filter((finding) => finding.remediationRequired || finding.attestationRequired)
    .map((finding) => ({
      id: `plan-${finding.id}`,
      findingId: finding.id,
      control: controlTagForFinding(finding.id, finding.title, finding.description).control,
      controlFamily: controlTagForFinding(finding.id, finding.title, finding.description).controlFamily,
      controlName: controlTagForFinding(finding.id, finding.title, finding.description).controlName,
      title: finding.title,
      severity: finding.severity,
      owner: "Vendor",
      status: "OPEN",
      dueAt: finding.dueAt,
      requiredEvidence: finding.remediationRequired
        ? remediationRequiredEvidence(finding)
        : [],
      requiredAttestation: finding.attestationRequired
        ? [
            "Formal control owner attestation",
            "Executive or security owner confirmation",
          ]
        : [],
      releaseImpact:
        finding.remediationRequired || finding.attestationRequired
          ? "Release blocked pending remediation or attestation review."
          : "Reviewer validation required before release.",
    }));
}

function remediationFollowUpsFromPlans(plans: Array<{ title: string; control?: string; findingId?: string; requiredEvidence?: string[]; requiredAttestation?: string[] }>) {
  if (!plans.length) {
    return ["Reviewer should confirm evidence posture before release."];
  }

  return plans.flatMap((plan) => {
    const rows = [`Vendor must resolve: ${plan.control ?? plan.findingId}: ${plan.title}.`];

    if ((plan.requiredEvidence ?? []).length > 0) {
      rows.push(`Required evidence: ${(plan.requiredEvidence ?? []).join(", ")}.`);
    }

    if ((plan.requiredAttestation ?? []).length > 0) {
      rows.push(`Required attestation: ${(plan.requiredAttestation ?? []).join(", ")}.`);
    }

    rows.push("Reviewer validation required before governance release.");

    return rows;
  });
}
function findingText(findings: Array<{ severity: string; title: string; description: string; recommendation?: string | null }>) {
  return findings
    .map((finding) => `- [${finding.severity}] ${finding.title}: ${finding.description}${finding.recommendation ? ` Recommendation: ${finding.recommendation}` : ""}`)
    .join("\n");
}


async function forceBootstrapReviewResponse(assignmentId: number, organizationId: number | null, reviewRequestId: number | null) {
  const existing = await prisma.$queryRawUnsafe<any[]>(
    `
    select id
    from "ReviewResponse"
    where "reviewAssignmentId" = $1
    order by "updatedAt" desc, id desc
    limit 1
    `,
    assignmentId,
  );

  if (existing[0]) return existing[0];

  const created = await prisma.$queryRawUnsafe<any[]>(
    `
    insert into "ReviewResponse" (
      "organizationId",
      "reviewRequestId",
      "reviewAssignmentId",
      responses,
      "createdAt",
      "updatedAt"
    )
    values (
      $2,
      $3,
      $1,
      '{}'::jsonb,
      now(),
      now()
    )
    returning id
    `,
    assignmentId,
    organizationId,
    reviewRequestId,
  );

  return created[0] ?? null;
}
async function latestReviewResponse(tx: any, assignmentId: number) {
  const rows = await tx.$queryRaw<ReviewResponseRow[]>`
    select id, responses
    from "ReviewResponse"
    where "reviewAssignmentId" = ${assignmentId}
    order by "updatedAt" desc, id desc
    limit 1
  `;

  return rows[0] ?? null;
}


function assessmentAnswerValue(answer: any): string {
  if (answer?.valueJson === false) return "false";
  if (answer?.valueJson === true) return "true";

  const raw =
    answer?.value ??
    answer?.valueJson ??
    answer?.answer ??
    answer?.response ??
    "";

  if (typeof raw === "string") return raw.trim();
  if (raw == null) return "";

  try {
    return JSON.stringify(raw);
  } catch {
    return String(raw);
  }
}

function assessmentQuestionText(answer: any): string {
  return safeText(
    answer?.question?.text ||
      answer?.question?.description ||
      answer?.questionText ||
      answer?.prompt ||
      `Question #${answer?.questionId ?? "unknown"}`
  );
}

function assessmentAnswerIndicatesGap(value: string): boolean {
  const normalized = String(value ?? "").trim().toLowerCase();

  if (!normalized) return true;

  return (
    normalized === "false" ||
    normalized === "no" ||
    normalized.includes("false") ||
    normalized.includes("not implemented") ||
    normalized.includes("not available") ||
    normalized.includes("not provided") ||
    normalized.includes("missing") ||
    normalized.includes("incomplete") ||
    normalized.includes("partial") ||
    normalized.includes("pending") ||
    normalized.includes("unknown")
  );
}

function classifyAssessmentAnswerFinding(answer: any): FallbackFinding {
  const question = assessmentQuestionText(answer);
  const value = assessmentAnswerValue(answer);
  const text = `${question} ${value}`.toLowerCase();

  const dueAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

  if (text.includes("backup") || text.includes("recovery") || text.includes("restore")) {
    return {
      id: "cp-backup-recovery-procedures",
      severity: "HIGH",
      title: "CP-9 / CP-10 Backup and Recovery Procedure Gap",
      description: `Vendor response indicates a backup and recovery control gap. Evidence signal: ${question} -> ${value}.`,
      recommendation:
        "Provide backup and recovery procedures, restore testing evidence, recovery ownership, and backup protection documentation.",
      remediationRequired: true,
      attestationRequired: true,
      dueAt,
    };
  }

  if (text.includes("policy") || text.includes("policies") || text.includes("reviewed at least annually") || text.includes("annual")) {
    return {
      id: "pl-policy-review-governance",
      severity: "MEDIUM",
      title: "PL-2 / PM-9 Security Policy Review Governance Gap",
      description: `Vendor response indicates policies are not reviewed at least annually. Evidence signal: ${question} -> ${value}.`,
      recommendation:
        "Provide current security policies, annual review records, approval evidence, and policy owner attestation.",
      remediationRequired: true,
      attestationRequired: true,
      dueAt,
    };
  }

  if (text.includes("endpoint") || text.includes("managed security tooling") || text.includes("protected with managed")) {
    return {
      id: "si-endpoint-protection-tooling",
      severity: "HIGH",
      title: "SI-3 / SI-4 Endpoint Protection and Monitoring Gap",
      description: `Vendor response indicates endpoint protection tooling is not fully implemented. Evidence signal: ${question} -> ${value}.`,
      recommendation:
        "Provide endpoint protection deployment evidence, managed security tooling coverage, alerting evidence, and endpoint exception tracking.",
      remediationRequired: true,
      attestationRequired: true,
      dueAt,
    };
  }

  if (text.includes("availability") || text.includes("critical systems monitored") || text.includes("monitored for availability")) {
    return {
      id: "ca-availability-monitoring",
      severity: "MEDIUM",
      title: "CA-7 / AU-6 Critical System Availability Monitoring Gap",
      description: `Vendor response indicates critical systems are not monitored for availability. Evidence signal: ${question} -> ${value}.`,
      recommendation:
        "Provide availability monitoring evidence, alerting procedures, escalation workflow, and monitoring owner attestation.",
      remediationRequired: true,
      attestationRequired: false,
      dueAt,
    };
  }

  return {
    id: `assessment-answer-gap-${answer?.questionId ?? crypto.randomUUID()}`,
    severity: "MEDIUM",
    title: "CA-2 / CA-7 Questionnaire Control Validation Gap",
    description: `Vendor response indicates a control gap requiring reviewer validation. Evidence signal: ${question} -> ${value}.`,
    recommendation:
      "Provide control implementation evidence, remediation evidence, compensating controls, or control owner attestation.",
    remediationRequired: true,
    attestationRequired: false,
    dueAt,
  };
}

function buildFindingsFromAssessmentAnswers(answers: any[]): FallbackFinding[] {
  const findingMap = new Map<string, FallbackFinding>();

  for (const answer of answers) {
    const value = assessmentAnswerValue(answer);

    if (!assessmentAnswerIndicatesGap(value)) continue;

    const finding = classifyAssessmentAnswerFinding(answer);

    if (!findingMap.has(finding.id)) {
      findingMap.set(finding.id, finding);
    }
  }

  return Array.from(findingMap.values());
}
export async function POST(_request: Request, context: RouteContext) {
  try {
    const { id: rawId } = await context.params;
    const assignmentId = parseId(rawId);

    if (!assignmentId) {
      return NextResponse.json({ ok: false, error: "Invalid review assignment id." }, { status: 400 });
    }
    const assignmentRows = await prisma.$queryRawUnsafe<
      Array<{
        id: number;
        organizationId: number | null;
        vendorId: number;
        reviewRequestId: number;
        assignmentType: string | null;
        status: string | null;
      }>
    >(
      `
      select
        id,
        "organizationId",
        "vendorId",
        "reviewRequestId",
        "assignmentType",
        status::text as status
      from "ReviewAssignment"
      where id = $1
      limit 1
      `,
      assignmentId,
    );

    const assignment = assignmentRows[0] ?? null;

    if (!assignment) {
      return NextResponse.json({ ok: false, error: "Review assignment not found." }, { status: 404 });
    }

    const vendor = await prisma.vendor.findUnique({
      where: { id: assignment.vendorId },
      select: { id: true, name: true },
    });

    const vendorName = vendor?.name ?? "This vendor";

    const frameworkAssessment = await prisma.truvernFrameworkAssessment.findFirst({
      where: { reviewAssignmentId: assignmentId },
      include: {
        responses: {
          include: {
            question: {
              include: {
                control: true,
              },
            },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    await forceBootstrapReviewResponse(
      assignmentId,
      assignment.organizationId,
      assignment.reviewRequestId,
    );

    const generatedAt = new Date();

    if (!frameworkAssessment || frameworkAssessment.responses.length === 0) {
      const output = await prisma.$transaction(async (tx) => {
        let responseRow = await latestReviewResponse(tx, assignmentId);

        if (!responseRow) {
          const createdRows: any[] = await tx.$queryRawUnsafe(
            `
            insert into "ReviewResponse" (
              "organizationId",
              "reviewRequestId",
              "reviewAssignmentId",
              responses,
              "createdAt",
              "updatedAt"
            )
            values (
              $2,
              $3,
              $1,
              '{}'::jsonb,
              now(),
              now()
            )
            returning id, responses
            `,
            assignmentId,
            assignment.organizationId,
            assignment.reviewRequestId,
          );

          responseRow = createdRows?.[0] ?? null;
        }

        if (!responseRow) {
          throw new Error("Unable to create review response.");
        }

        const existingResponses = safeObject(responseRow.responses);

        const submittedAssessmentRows: any[] = await tx.$queryRawUnsafe(
          `
          select id
          from "Assessment"
          where "vendorId" = $1
            and "organizationId" = $2
            and upper(status::text) in ('SUBMITTED','REVIEW_READY')
          order by "submittedAt" desc nulls last, id desc
          limit 1
          `,
          assignment.vendorId,
          assignment.organizationId,
        );

        const submittedAssessmentId = submittedAssessmentRows?.[0]?.id ?? null;

        const assessmentAnswerRows: any[] = submittedAssessmentId
          ? await tx.assessmentAnswer.findMany({
              where: {
                assessmentId: submittedAssessmentId,
              },
              include: {
                question: true,
              },
              orderBy: {
                id: "asc",
              },
            })
          : [];

        const responseDrivenFindings = buildFindingsFromAssessmentAnswers(assessmentAnswerRows);

        const findings =
          responseDrivenFindings.length > 0
            ? responseDrivenFindings
            : fallbackFindingsFromResponses(existingResponses, vendorName);
        const remediationRequired = findings.some((finding) => finding.remediationRequired);
        const attestationRequired = findings.some((finding) => finding.attestationRequired);
        let remediationPlans = buildRemediationPlans(findings);
      remediationPlans = enrichRemediationPlans(remediationPlans, findings);
        const releaseBlockedByPlans = remediationPlans.some((plan) => plan.status !== "COMPLETE");
        const riskLevel = remediationRequired || releaseBlockedByPlans ? "HIGH" : "MEDIUM";
        const decision = decisionForRisk(riskLevel, remediationRequired || attestationRequired || releaseBlockedByPlans);

        const executiveSummary = [
          `${vendorName} completed a Truvern governance review.`,
          `Risk level: ${riskLevel}.`,
          `Decision: ${decision}.`,
          `${findings.length} governance finding(s) require reviewer validation.`,
          remediationRequired || attestationRequired
            ? `Remediation and/or attestation is required before release approval.`
            : `No mandatory release blocker was identified from the available review payload.`
        ].join("\n\n");

        const finalAssessment = remediationRequired
          ? "Governance review cannot be released until remediation evidence and required attestations are submitted, reviewed, and approved."
          : "Governance review is eligible for release after reviewer validation and approval.";

        const intelligence = {
          generatedAt: generatedAt.toISOString(),
          source: responseDrivenFindings.length > 0 ? "assessment-answer-response-driven-engine" : "review-response-fallback-engine",
          frameworkAssessmentId: null,
          assessmentId: submittedAssessmentId,
          assessmentAnswerCount: assessmentAnswerRows.length,
          responseDrivenFindingsCount: responseDrivenFindings.length,
          score: {
            score: remediationRequired ? 70 : 88,
            maxScore: 100,
            riskLevel,
          },
          findings,
          executiveSummary,
          finalRecommendation: finalAssessment,
          followUps: remediationFollowUpsFromPlans(remediationPlans),
          timeline: [
            {
              label: "Reviewer intelligence generated",
              at: generatedAt.toISOString(),
              actor: "Truvern Findings Engine",
            },
          ],
        };

        const remediation = {
          generatedAt: generatedAt.toISOString(),
          remediationStatus: releaseBlockedByPlans ? "REMEDIATION_RECOMMENDED" : "READY_FOR_RELEASE",
          remediationDueAt: remediationPlans.find((plan) => plan.dueAt)?.dueAt ?? findings.find((finding) => finding.dueAt)?.dueAt ?? null,
          plans: remediationPlans,
          requests: findings
            .filter((finding) => finding.remediationRequired)
            .map((finding) => ({
              id: String(finding.id),
              status: "RECOMMENDED",
              requestText: finding.recommendation,
              dueAt: finding.dueAt,
            })),
          attestationRequests: findings
            .filter((finding) => finding.attestationRequired)
            .map((finding) => ({
              id: String(finding.id),
              title: `${finding.title} attestation`,
              description: finding.recommendation,
              status: "RECOMMENDED",
              expiresAt: finding.dueAt,
            })),
          history: [
            {
              label: responseDrivenFindings.length > 0 ? "Assessment-answer findings generated" : "Fallback findings generated",
              at: generatedAt.toISOString(),
              count: findings.length,
            },
          ],
          reviewerConditions: remediationRequired
            ? ["Resolve recommended remediation evidence before release."]
            : [],
        };

        const nextResponses = {
          ...existingResponses,
          riskLevel,
          decision,
          intelligenceMode:
  findings.length > 0
    ? "assessment-answer-response-driven"
    : "fallback",
          findings: findingText(findings),
          executiveSummary,
          finalAssessment,
          truvernReviewerIntelligence: intelligence,
          truvernRemediation: remediation,
          conditionsAndFollowUps: remediationFollowUpsFromPlans(remediationPlans),
          releaseState: releaseBlockedByPlans ? "BLOCKED" : "READY_FOR_RELEASE",
          releaseBlocked: remediationRequired || attestationRequired || releaseBlockedByPlans,
          generatedFindingsAt: generatedAt.toISOString(),
        };

        await tx.$executeRaw`
          update "ReviewResponse"
          set responses = ${JSON.stringify(nextResponses)}::jsonb,
              "updatedAt" = now()
          where id = ${responseRow.id}
        `;

        await tx.$executeRawUnsafe(
          `
          update "ReviewAssignment"
          set
            status = $2::text,
            "reviewerName" = 'Truvern Review Team',
            "assignedReviewerName" = 'Truvern Review Team',
            "assignedTo" = 'Truvern Review Team',
            "updatedAt" = now()
          where id = $1
          `,
          assignmentId,
          remediationRequired || attestationRequired ? "IN_PROGRESS" : "SUBMITTED",
        );

        return {
          findings,
          riskLevel,
          decision,
          intelligenceMode:
  findings.length > 0
    ? "assessment-answer-response-driven"
    : "fallback",
          remediationRequired,
          attestationRequired,
          responseUpdated: true,
          fallback: true,
        };
      });

      return NextResponse.json({ ok: true, ...output });
    }

    const result = generateFindings(normalizeResponses(frameworkAssessment.responses));
    const dueFallback = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const output = await prisma.$transaction(async (tx) => {
      await tx.truvernAssessmentFinding.deleteMany({
        where: {
          assessmentId: frameworkAssessment.id,
          status: { in: ["OPEN", "REMEDIATION_REQUESTED"] },
        },
      });

      await tx.truvernAssessmentAttestation.deleteMany({
        where: {
          assessmentId: frameworkAssessment.id,
          status: { in: ["REQUESTED", "SUBMITTED"] },
        },
      });

      if (result.findings.length > 0) {
        await tx.truvernAssessmentFinding.createMany({
          data: result.findings.map((finding) => ({
            assessmentId: frameworkAssessment.id,
            controlId: Number.isInteger(Number(finding.controlKey)) ? Number(finding.controlKey) : null,
            severity: toSeverity(finding.severity),
            status: "OPEN",
            title: finding.title,
            description: finding.description,
            recommendation: finding.recommendation ?? "Reviewer validation required before release.",
            remediationRequired: finding.remediationRequired,
            attestationRequired: finding.attestationRequired,
            dueAt: new Date(Date.now() + finding.dueInDays * 24 * 60 * 60 * 1000),
            metadata: finding.metadata as Prisma.InputJsonValue,
          })),
        });
      }

      const findings = await tx.truvernAssessmentFinding.findMany({
        where: { assessmentId: frameworkAssessment.id },
        include: {
          control: { select: { controlId: true, family: true, title: true } },
        },
        orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
      });

      const remediationRequests: any[] = [];
      const attestationRequests: any[] = [];

      for (const finding of findings.filter((item) => item.remediationRequired)) {
        const request = await tx.truvernRemediationRequest.create({
          data: {
            findingId: finding.id,
            status: "REQUESTED",
            requestText: finding.recommendation ?? "Please provide remediation evidence or corrective action documentation.",
            dueAt: finding.dueAt ?? dueFallback,
            metadata: {
              source: "review-desk-generate-findings",
              assignmentId,
              frameworkAssessmentId: frameworkAssessment.id,
              severity: finding.severity,
            },
          },
        });

        await tx.truvernAssessmentFinding.update({
          where: { id: finding.id },
          data: { status: "REMEDIATION_REQUESTED" },
        });

        remediationRequests.push(request);
      }

      for (const finding of findings.filter((item) => item.attestationRequired)) {
        const controlLabel = finding.control ? `${finding.control.controlId} · ${finding.control.title}` : finding.title;

        const attestation = await tx.truvernAssessmentAttestation.create({
          data: {
            assessmentId: frameworkAssessment.id,
            title: `Attestation required: ${controlLabel}`,
            description: finding.recommendation ?? "Please provide a signed attestation, certification, or formal assurance statement.",
            status: "REQUESTED",
            expiresAt: finding.dueAt ?? dueFallback,
            metadata: {
              source: "review-desk-generate-findings",
              assignmentId,
              frameworkAssessmentId: frameworkAssessment.id,
              findingId: finding.id,
              severity: finding.severity,
              controlId: finding.controlId,
              controlCode: finding.control?.controlId ?? null,
              family: finding.control?.family ?? null,
            },
          },
        });

        attestationRequests.push(attestation);
      }

      const riskLevel = result.score.riskLevel;
      const frameworkFallbackFindings = findings.map((finding) => ({
        id: String(finding.id),
        severity: finding.severity,
        title: finding.title,
        description: finding.description,
        recommendation: finding.recommendation ?? "Reviewer validation required before release.",
        remediationRequired: finding.remediationRequired,
        attestationRequired: finding.attestationRequired,
        dueAt: finding.dueAt?.toISOString() ?? null,
      }));
      let remediationPlans = buildRemediationPlans(frameworkFallbackFindings);
      remediationPlans = enrichRemediationPlans(remediationPlans, frameworkFallbackFindings);
      const blocked = remediationRequests.length > 0 || attestationRequests.length > 0 || remediationPlans.some((plan) => plan.status !== "COMPLETE");
      const decision = decisionForRisk(riskLevel, blocked);

      const executiveSummary = [
        `${vendorName} completed a Truvern governance assessment.`,
        `Governance score: ${result.score.score}/${result.score.maxScore}.`,
        `Residual risk level: ${riskLevel}.`,
        `${findings.length} finding(s) identified.`,
        `${remediationRequests.length} remediation request(s) generated.`,
        `${attestationRequests.length} attestation request(s) generated.`,
        blocked
          ? `Release remains blocked pending remediation and attestation review.`
          : `Assessment is eligible for release review.`
      ].join("\n\n");

      const finalAssessment = blocked
        ? "Assessment remains in remediation status. All remediation requests, evidence submissions, and attestations must be reviewed before release approval."
        : "Assessment satisfies current governance review requirements and may proceed to release approval.";

      const intelligence = {
        generatedAt: generatedAt.toISOString(),
        source: "truvern-findings-engine",
        frameworkAssessmentId: frameworkAssessment.id,
        score: result.score,
        findings: findings.map((finding) => ({
          id: String(finding.id),
          controlId: finding.controlId,
          controlCode: finding.control?.controlId ?? null,
          family: finding.control?.family ?? null,
          severity: finding.severity,
          status: finding.status,
          title: finding.title,
          description: finding.description,
          recommendation: finding.recommendation ?? "Reviewer validation required before release.",
          remediationRequired: finding.remediationRequired,
          attestationRequired: finding.attestationRequired,
          dueAt: finding.dueAt?.toISOString() ?? null,
        })),
        executiveSummary,
        finalRecommendation: finalAssessment,
        followUps: remediationFollowUpsFromPlans(remediationPlans),
        timeline: [
          {
            label: "Reviewer intelligence generated",
            at: generatedAt.toISOString(),
            actor: "Truvern Findings Engine",
          },
        ],
      };

      const remediation = {
        generatedAt: generatedAt.toISOString(),
        remediationStatus: blocked ? "REMEDIATION_REQUESTED" : "READY_FOR_RELEASE",
        remediationDueAt: remediationPlans.find((plan) => plan.dueAt)?.dueAt ?? remediationRequests[0]?.dueAt?.toISOString?.() ?? attestationRequests[0]?.expiresAt?.toISOString?.() ?? null,
        plans: remediationPlans,
        requests: remediationRequests.map((request) => {
          const plan = remediationPlans.find((item: any) => String(item.findingId ?? item.id) === String(request.findingId));

          return {
            id: request.id,
            findingId: request.findingId,
            title: plan?.title ?? request.requestText,
            status: request.status,
            blockerStatus: request.status === "COMPLETE" ? "RESOLVED" : "OPEN",
            evidenceStatus: "REQUESTED",
            requestText: request.requestText,
            dueAt: request.dueAt?.toISOString() ?? null,
            requiredEvidence: Array.isArray(plan?.requiredEvidence) ? plan.requiredEvidence : [],
            requiredAttestation: Array.isArray(plan?.requiredAttestation) ? plan.requiredAttestation : [],
          };
        }),
        attestationRequests: attestationRequests.map((attestation) => ({
          id: attestation.id,
          title: attestation.title,
          description: attestation.description,
          status: attestation.status,
          expiresAt: attestation.expiresAt?.toISOString() ?? null,
        })),
        history: [
          { label: "Findings generated", at: generatedAt.toISOString(), count: findings.length },
          { label: "Remediation requests created", at: generatedAt.toISOString(), count: remediationRequests.length },
          { label: "Attestation requests created", at: generatedAt.toISOString(), count: attestationRequests.length },
        ],
        reviewerConditions: remediationFollowUpsFromPlans(remediationPlans),
      };

      await tx.truvernFrameworkAssessment.update({
        where: { id: frameworkAssessment.id },
        data: {
          score: result.score.score,
          maxScore: result.score.maxScore,
          riskLevel,
          status: remediationRequests.length > 0 ? "REMEDIATION_REQUESTED" : attestationRequests.length > 0 ? "ATTESTATION_REQUESTED" : "READY_FOR_RELEASE",
          readyForReleaseAt: blocked ? null : generatedAt,
          metadata: {
            ...(safeObject(frameworkAssessment.metadata) as Prisma.InputJsonObject),
            scoring: result.score,
            findingsGeneratedAt: generatedAt.toISOString(),
            remediationRequired: remediationRequests.length > 0,
            attestationRequired: attestationRequests.length > 0,
            reviewAssignmentId: assignmentId,
          },
        },
      });

      const responseRow = await latestReviewResponse(tx, assignmentId);

      if (responseRow) {
        const existingResponses = safeObject(responseRow.responses);
        const nextResponses = {
          ...existingResponses,
          riskLevel,
          decision,
          intelligenceMode:
  findings.length > 0
    ? "assessment-answer-response-driven"
    : "fallback",
          findings: findingText(findings),
          executiveSummary,
          finalAssessment,
          truvernReviewerIntelligence: intelligence,
          truvernRemediation: remediation,
          conditionsAndFollowUps: remediationFollowUpsFromPlans(remediationPlans),
          releaseState: blocked ? "BLOCKED" : "READY_FOR_RELEASE",
          releaseBlocked: blocked,
          generatedFindingsAt: generatedAt.toISOString(),
        };

        await tx.$executeRaw`
          update "ReviewResponse"
          set responses = ${JSON.stringify(nextResponses)}::jsonb,
              "updatedAt" = now()
          where id = ${responseRow.id}
        `;
      }

      await tx.$executeRawUnsafe(
          `
          update "ReviewAssignment"
          set
            status = $2::text,
            "reviewerName" = 'Truvern Review Team',
            "assignedReviewerName" = 'Truvern Review Team',
            "assignedTo" = 'Truvern Review Team',
            "updatedAt" = now()
          where id = $1
          `,
          assignmentId,
          blocked ? "IN_PROGRESS" : "SUBMITTED",
        );

      return {
        findings,
        remediationRequests,
        attestationRequests,
        riskLevel,
        decision,
        responseUpdated: Boolean(responseRow),
      };
    });

    return NextResponse.json({
      ok: true,
      frameworkAssessmentId: frameworkAssessment.id,
      score: result.score,
      remediationRequired: output.remediationRequests.length > 0,
      attestationRequired: output.attestationRequests.length > 0,
      findings: output.findings,
      remediationRequests: output.remediationRequests,
      attestationRequests: output.attestationRequests,
      riskLevel: output.riskLevel,
      decision: output.decision,
      responseUpdated: output.responseUpdated,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to generate review findings.",
      },
      { status: 500 },
    );
  }
}





































