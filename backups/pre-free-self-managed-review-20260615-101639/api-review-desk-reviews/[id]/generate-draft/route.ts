import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireDbOrganization } from "@/lib/org-db";
import { resolveOrganizationPlanTier } from "@/lib/billing/organization-plan";
import { isTruvernOperator } from "@/lib/truvern-ops-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
async function requireApiAuth() {
  const { userId } = await auth();

  if (!userId) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401, headers: { "cache-control": "no-store" } },
      ),
    };
  }

  try {
    const org = await requireDbOrganization();

    return {
      ok: true as const,
      userId,
      org,
    };
  } catch {
    return {
      ok: false as const,
      response: NextResponse.json(
        { ok: false, error: "Organization required" },
        { status: 403, headers: { "cache-control": "no-store" } },
      ),
    };
  }
}

type RouteContext = {
  params: Promise<{ id: string }>;
};

function safeStr(v: unknown) {
  return typeof v === "string" ? v.trim() : "";
}

function upper(v: unknown) {
  return safeStr(v).toUpperCase();
}

function safeInt(v: unknown) {
  const n = Number(String(v ?? "").trim());
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

function json(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

function inferRiskLevel(vendor: any, assessmentRun: any) {
  const score = Number(vendor?.riskScore ?? assessmentRun?.score ?? 0);
  const criticality = upper(vendor?.criticality);

  if (criticality === "CRITICAL" || score >= 80) return "HIGH";
  if (criticality === "HIGH" || score >= 60) return "MEDIUM";
  if (score > 0 && score < 35) return "LOW";

  return "MEDIUM";
}

function inferDecision(riskLevel: string) {
  if (riskLevel === "HIGH" || riskLevel === "CRITICAL") {
    return "APPROVE_WITH_CONDITIONS";
  }

  return "APPROVE";
}

function buildFindings(args: {
  vendor: any;
  assessmentRun: any;
  riskLevel: string;
  decision: string;
}) {
  const vendor = args.vendor;
  const assessmentRun = args.assessmentRun;

  const vendorName = safeStr(vendor?.name) || "Vendor";
  const category = safeStr(vendor?.category) || "General";
  const criticality = safeStr(vendor?.criticality) || "STANDARD";

  const assessmentStatus =
    safeStr(assessmentRun?.status) || "REVIEW";

  const riskScore =
    vendor?.riskScore != null
      ? String(vendor.riskScore)
      : "Not currently scored";

  const completedAt =
  assessmentRun?.completedAt ||
  assessmentRun?.submittedAt ||
  assessmentRun?.sealedAt ||
  assessmentRun?.finishedAt ||
  assessmentRun?.updatedAt ||
  null;

const formattedCompletedAt = completedAt
  ? new Date(completedAt).toLocaleString()
  : null;

  return [
    `EXECUTIVE SUMMARY`,
    ``,
    `${vendorName} completed a Truvern governance assessment review for operational, security, and vendor risk evaluation.`,
    ``,
    `Truvern performed an initial governance review using submitted assessment data, vendor profile context, operational metadata, and available evidence artifacts.`,
    ``,
    `Overall governance recommendation: ${args.decision}.`,
    ``,
    `Residual risk assessment: ${args.riskLevel}.`,
    ``,
    `VENDOR PROFILE`,
    ``,
    `Vendor name: ${vendorName}`,
    `Category: ${category}`,
    `Criticality: ${criticality}`,
    `Vendor risk score: ${riskScore}`,
    ``,
    `ASSESSMENT CONTEXT`,
    ``,
    `Assessment workflow status: ${assessmentStatus}`,
    formattedCompletedAt
  ? `Assessment completion timestamp: ${formattedCompletedAt}`
  : `Assessment completion timestamp: Pending`,
    ``,
    `INITIAL GOVERNANCE OBSERVATIONS`,
    ``,
    `â€¢ Vendor profile and submitted assessment indicate an operational posture consistent with the declared business category and criticality level.`,
    ``,
    `â€¢ No immediate critical blockers were identified during automated draft analysis.`,
    ``,
    `â€¢ Additional operator review, evidence validation, and governance verification may still be required prior to formal release.`,
    ``,
    `RECOMMENDED GOVERNANCE OUTCOME`,
    ``,
    `Decision recommendation: ${args.decision}`,
    `Residual risk classification: ${args.riskLevel}`,
    ``,
    `TRUVERN GOVERNANCE REVIEW`,
``,
`This assessment was reviewed through Truvern governance workflows using submitted assessment materials, vendor operational context, evidence documentation, and risk evaluation procedures.`,
``,
`Based on the available assessment information and governance review process, Truvern determined that the current recommendation and residual risk classification accurately reflect the vendor's present operational and risk posture.`,
``,
`This assessment outcome is prepared for governance release and customer consumption.`,
``
  ].join("\n");
}


// CREATE_BASELINE_REVIEW_RESPONSE_WHEN_MISSING
async function ensureReviewResponseForAssignment({
  reviewAssignmentId,
  organizationId,
  vendorId,
}: {
  reviewAssignmentId: number;
  organizationId: number | null;
  vendorId: number | null;
}) {
  const existing: any[] = await prisma.$queryRawUnsafe(
    `
    select id, responses
    from "ReviewResponse"
    where "reviewAssignmentId" = $1
    order by "updatedAt" desc, id desc
    limit 1
    `,
    reviewAssignmentId,
  );

  if (existing[0]) return existing[0];

  const created: any[] = await prisma.$queryRawUnsafe(
    `
    insert into "ReviewResponse" (
      "reviewAssignmentId",
      "organizationId",
      "vendorId",
      responses,
      "createdAt",
      "updatedAt"
    )
    values (
      $1,
      $2,
      $3,
      jsonb_build_object(
        'intent', 'reviewer_intelligence',
        'releaseState', 'DRAFT',
        'assessmentGeneratedAt', now(),
        'reviewFinalizedAt', now(),
        'truvernReviewerIntelligence', jsonb_build_object(
          'riskLevel', 'Not recorded',
          'decision', 'Not recorded',
          'findings', '[]'::jsonb,
          'executiveSummary', 'Not recorded.',
          'finalAssessment', 'Not recorded.'
        )
      ),
      now(),
      now()
    )
    returning id, responses
    `,
    reviewAssignmentId,
    organizationId,
    vendorId,
  );

  return created[0];
}

function answerTextValue(answer: any): string {
  if (answer?.valueJson === false) return "false";
  if (answer?.valueJson === true) return "true";

  const raw =
    answer?.value ??
    answer?.valueJson ??
    answer?.answer ??
    answer?.response ??
    answer?.text ??
    "";

  if (typeof raw === "string") return raw;
  if (raw == null) return "";

  try {
    return JSON.stringify(raw);
  } catch {
    return String(raw);
  }
}

function questionTextValue(answer: any): string {
  return safeStr(
    answer?.question?.text ||
      answer?.question?.description ||
      answer?.questionText ||
      answer?.prompt ||
      `Question #${answer?.questionId ?? "unknown"}`,
  );
}

function answerIndicatesGap(value: string): boolean {
  const normalized = value.toLowerCase();

  if (!normalized.trim()) return true;

  return (
    normalized.includes("false") ||
    normalized.includes("no") ||
    normalized.includes("not ") ||
    normalized.includes("missing") ||
    normalized.includes("incomplete") ||
    normalized.includes("none") ||
    normalized.includes("unknown") ||
    normalized.includes("partial") ||
    normalized.includes("pending") ||
    normalized.includes("manual") ||
    normalized.includes("not implemented") ||
    normalized.includes("not available") ||
    normalized.includes("not provided")
  );
}

function classifyFrameworkFinding(question: string, value: string) {
  const text = `${question} ${value}`.toLowerCase();

  if (text.includes("mfa") || text.includes("multi-factor") || text.includes("access") || text.includes("account") || text.includes("privileged")) {
    return {
      id: "ac-ia-access-control",
      control: "AC-2 / IA-2",
      title: "Access Control and MFA Governance Validation Required",
      severity: "HIGH",
      controlFamily: "Access Control / Identification and Authentication",
      controlName: "Account Management and Multi-Factor Authentication",
      recommendation:
        "Provide access review reports, privileged access procedures, MFA enforcement evidence, and account lifecycle documentation.",
      requiredEvidence: [
        "User access review report",
        "Privileged access control procedure",
        "MFA enforcement evidence",
        "Account lifecycle documentation",
      ],
      requiredAttestation: [
        "Formal access control owner attestation",
        "Security owner confirmation",
      ],
    };
  }

  if (text.includes("incident") || text.includes("ir-") || text.includes("breach") || text.includes("tabletop") || text.includes("response plan")) {
    return {
      id: "ir-incident-response",
      control: "IR-4 / IR-8",
      title: "Incident Response Evidence Gap",
      severity: "MEDIUM",
      controlFamily: "Incident Response",
      controlName: "Incident Handling and Incident Response Plan",
      recommendation:
        "Provide incident response plan, tabletop exercise evidence, escalation procedures, and incident response testing records.",
      requiredEvidence: [
        "Incident response plan",
        "Tabletop exercise evidence",
        "Escalation procedure",
        "Incident response testing record",
      ],
      requiredAttestation: ["Incident response owner attestation"],
    };
  }

  if (text.includes("log") || text.includes("audit") || text.includes("monitor") || text.includes("alert") || text.includes("siem")) {
    return {
      id: "au-audit-monitoring",
      control: "AU-6 / AU-12",
      title: "Audit Logging and Monitoring Validation Required",
      severity: "MEDIUM",
      controlFamily: "Audit and Accountability",
      controlName: "Audit Review, Analysis, Reporting, and Record Generation",
      recommendation:
        "Provide logging standards, SIEM or monitoring evidence, alert review procedures, and retention policy documentation.",
      requiredEvidence: [
        "Logging standard",
        "SIEM or monitoring evidence",
        "Alert review procedure",
        "Log retention policy",
      ],
      requiredAttestation: ["Audit logging control owner attestation"],
    };
  }

  if (text.includes("policy") || text.includes("policies") || text.includes("reviewed at least annually") || text.includes("annual")) {
    return {
      id: "pl-policy-review-governance",
      control: "PL-2 / PM-9",
      title: "Security Policy Review Governance Gap",
      severity: "MEDIUM",
      controlFamily: "Planning / Program Management",
      controlName: "System Security Plan and Risk Management Strategy",
      recommendation:
        "Provide current security policies, annual review evidence, approval records, and policy owner attestation.",
      requiredEvidence: [
        "Current security policy set",
        "Annual policy review record",
        "Policy approval evidence",
        "Policy owner attestation",
      ],
      requiredAttestation: ["Security policy owner attestation"],
    };
  }

  if (text.includes("endpoint") || text.includes("managed security tooling") || text.includes("protected with managed")) {
    return {
      id: "si-endpoint-protection",
      control: "SI-3 / SI-4",
      title: "Endpoint Protection and Monitoring Gap",
      severity: "HIGH",
      controlFamily: "System and Information Integrity",
      controlName: "Malicious Code Protection and System Monitoring",
      recommendation:
        "Provide endpoint protection deployment evidence, managed security tooling coverage, alerting evidence, and exception tracking.",
      requiredEvidence: [
        "Endpoint protection deployment evidence",
        "Managed security tooling coverage report",
        "Alerting and monitoring evidence",
        "Endpoint exception tracking",
      ],
      requiredAttestation: ["Endpoint security owner attestation"],
    };
  }

  if (text.includes("availability") || text.includes("critical systems monitored")) {
    return {
      id: "ca-availability-monitoring",
      control: "CA-7 / AU-6",
      title: "Critical System Availability Monitoring Gap",
      severity: "MEDIUM",
      controlFamily: "Security Assessment / Audit and Accountability",
      controlName: "Continuous Monitoring and Audit Review",
      recommendation:
        "Provide availability monitoring evidence, uptime alerting procedures, escalation workflow, and monitoring ownership attestation.",
      requiredEvidence: [
        "Availability monitoring evidence",
        "Uptime alerting procedure",
        "Escalation workflow",
        "Monitoring owner attestation",
      ],
      requiredAttestation: ["Monitoring owner attestation"],
    };
  }

  if (text.includes("backup") || text.includes("recovery") || text.includes("restore") || text.includes("continuity") || text.includes("disaster")) {
    return {
      id: "cp-backup-recovery",
      control: "CP-9 / CP-10",
      title: "Backup and Recovery Validation Required",
      severity: "MEDIUM",
      controlFamily: "Contingency Planning",
      controlName: "System Backup and Recovery",
      recommendation:
        "Provide backup policy, restore test evidence, recovery procedure, and business continuity documentation.",
      requiredEvidence: [
        "Backup policy",
        "Restore test evidence",
        "Recovery procedure",
        "Business continuity plan",
      ],
      requiredAttestation: ["Continuity or infrastructure owner attestation"],
    };
  }

  if (text.includes("vulnerab") || text.includes("patch") || text.includes("remediation") || text.includes("flaw") || text.includes("scan")) {
    return {
      id: "ra-si-vulnerability-management",
      control: "RA-5 / SI-2",
      title: "Vulnerability and Patch Management Evidence Gap",
      severity: "HIGH",
      controlFamily: "Risk Assessment / System and Information Integrity",
      controlName: "Vulnerability Monitoring and Flaw Remediation",
      recommendation:
        "Provide vulnerability scan results, patch reports, remediation SLA evidence, and exception tracking records.",
      requiredEvidence: [
        "Vulnerability scan report",
        "Patch management report",
        "Remediation SLA evidence",
        "Exception tracking record",
      ],
      requiredAttestation: ["Vulnerability management owner attestation"],
    };
  }

  if (text.includes("change") || text.includes("configuration") || text.includes("baseline") || text.includes("approval")) {
    return {
      id: "cm-change-configuration",
      control: "CM-2 / CM-3",
      title: "Configuration and Change Management Evidence Gap",
      severity: "MEDIUM",
      controlFamily: "Configuration Management",
      controlName: "Baseline Configuration and Configuration Change Control",
      recommendation:
        "Provide configuration baseline evidence, change approval records, and change management workflow documentation.",
      requiredEvidence: [
        "Configuration baseline evidence",
        "Change approval record",
        "Change management procedure",
        "Implementation review evidence",
      ],
      requiredAttestation: ["Configuration management owner attestation"],
    };
  }

  if (text.includes("training") || text.includes("awareness") || text.includes("employee")) {
    return {
      id: "at-security-awareness",
      control: "AT-2",
      title: "Security Awareness Training Validation Required",
      severity: "LOW",
      controlFamily: "Awareness and Training",
      controlName: "Literacy Training and Awareness",
      recommendation:
        "Provide security awareness training records, completion reports, and annual training policy.",
      requiredEvidence: [
        "Security awareness training policy",
        "Training completion report",
        "Employee training evidence",
      ],
      requiredAttestation: ["Training program owner attestation"],
    };
  }

  if (text.includes("vendor") || text.includes("supplier") || text.includes("third party") || text.includes("supply chain")) {
    return {
      id: "sr-vendor-governance",
      control: "SR-6 / RA-3",
      title: "Vendor and Supply Chain Risk Validation Required",
      severity: "MEDIUM",
      controlFamily: "Supply Chain Risk Management / Risk Assessment",
      controlName: "Supplier Reviews and Risk Assessment",
      recommendation:
        "Provide vendor risk review evidence, supplier monitoring records, and risk assessment methodology.",
      requiredEvidence: [
        "Vendor risk review evidence",
        "Supplier monitoring record",
        "Risk assessment methodology",
        "Risk register extract",
      ],
      requiredAttestation: ["Vendor governance owner attestation"],
    };
  }

  return {
    id: "ca-control-validation",
    control: "CA-2 / CA-7",
    title: "Control Assessment Validation Required",
    severity: "MEDIUM",
    controlFamily: "Security Assessment and Authorization",
    controlName: "Control Assessment and Continuous Monitoring",
    recommendation:
      "Provide control assessment evidence, monitoring records, remediation evidence, or owner attestation.",
    requiredEvidence: [
      "Control assessment evidence",
      "Continuous monitoring record",
      "Remediation evidence",
      "Control owner attestation",
    ],
    requiredAttestation: ["Control owner attestation"],
  };
}

function buildResponseDrivenFindingsV2(submittedAssessment: any, fallbackText: string) {
  const answers = Array.isArray(submittedAssessment?.answers)
    ? submittedAssessment.answers
    : [];

  const findingMap = new Map<string, any>();

  for (const answer of answers) {
    const question = questionTextValue(answer);
    const value = answerTextValue(answer);

    if (!answerIndicatesGap(value)) continue;

    const finding = classifyFrameworkFinding(question, value);
    const existing = findingMap.get(finding.id);

    const evidenceTrail = {
      question,
      response: value || "No answer provided",
      questionId: answer?.questionId ?? null,
    };

    if (existing) {
      existing.evidenceTrail.push(evidenceTrail);
      if (existing.severity !== "HIGH" && finding.severity === "HIGH") {
        existing.severity = "HIGH";
      }
    } else {
      findingMap.set(finding.id, {
        ...finding,
        evidenceTrail: [evidenceTrail],
        attestationRequired: finding.severity === "HIGH",
        remediationRequired: true,
        dueAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      });
    }
  }

  const findings = Array.from(findingMap.values()).slice(0, 12);

  if (findings.length === 0) {
    return {
      findingsText: fallbackText,
      responseDrivenFindings: [],
      intelligenceMode: "fallback",
    };
  }

  const findingsText = findings
    .map((finding) => {
      const sample = finding.evidenceTrail?.[0];

      return [
        `- [${finding.severity}] ${finding.control} ${finding.title}: ${finding.controlFamily}. ${finding.controlName}.`,
        `  Evidence signal: ${sample?.question ?? "Questionnaire response"} -> ${sample?.response ?? "Not provided"}`,
        `  Recommendation: ${finding.recommendation}`,
      ].join("\n");
    })
    .join("\n");

  return {
    findingsText,
    responseDrivenFindings: findings,
    intelligenceMode: "response-driven-v2",
  };
}
export async function POST(_req: Request, ctx: RouteContext) {
  const gate = await requireApiAuth();

  if (!gate.ok) {
    return gate.response;
  }

try {
    const params = await ctx.params;
    const assignmentId = safeInt(params?.id);

    if (!assignmentId) {
      return json(400, {
        ok: false,
        error: "Invalid assignment id.",
      });
    }

    const assignmentRows: any[] = await prisma.$queryRawUnsafe(
      `
      select *
      from "ReviewAssignment"
      where id = $1
      limit 1
      `,
      assignmentId,
    );

    const assignment = assignmentRows?.[0];

    if (!assignment) {
      return json(404, {
        ok: false,
        error: "Review assignment not found.",
      });
    }

    const canManageTruvernReview =
      await isTruvernOperator();

    const orgTier = gate.org && "id" in gate.org
  ? await resolveOrganizationPlanTier(Number((gate.org as any).id))
  : "FREE";

    const canUseFindingsEngine =
      canManageTruvernReview ||
      orgTier === "PRO" ||
      orgTier === "ENTERPRISE";

    if (!canUseFindingsEngine) {
      return json(403, {
        ok: false,
        code: "UPGRADE_REQUIRED",
        error:
          "Automated findings generation is available on Truvern Pro and Enterprise plans.",
      });
    }
    const assignmentType = upper(
  assignment.assignmentType || assignment.type || assignment.note,
);

const isTruvernReview = assignmentType.includes("TRUVERN");
const isInternalReview = assignmentType.includes("INTERNAL");

if (!isTruvernReview && !isInternalReview) {
  return json(409, {
    ok: false,
    error:
      "Draft generation is available for Truvern expert reviews and Pro internal governance reviews.",
  });
}

    const reviewRequestId = safeInt(
  assignment.reviewRequestId,
);

if (!reviewRequestId) {
  return json(409, {
    ok: false,
    error: "Review assignment is missing a review request.",
  });
}

const requestRows: any[] = await prisma.$queryRawUnsafe(
  `
  select *
  from "ReviewRequest"
  where id = $1
  limit 1
  `,
  reviewRequestId,
);

const request = requestRows?.[0];

if (!request) {
  return json(404, {
    ok: false,
    error: "Review request not found.",
  });
}

const vendorId = safeInt(request.vendorId);

if (!vendorId) {
  return json(409, {
    ok: false,
    error: "Review request is missing a vendor.",
  });
}

    const vendorRows: any[] = await prisma.$queryRawUnsafe(
      `
      select
  id,
  name,
  category,
  tier::text as tier,
  criticality::text as criticality,
  "riskScore",
  status,
  "organizationId"
from "Vendor"
      where id = $1
      limit 1
      `,
      vendorId,
    );

    const vendor = vendorRows?.[0];

    if (!vendor) {
      return json(404, {
        ok: false,
        error: "Vendor not found.",
      });
    }

    const assessmentRunRows: any[] = await prisma.$queryRawUnsafe(
      `
      select *
      from "AssessmentRun"
      where "vendorId" = $1
      order by
        "completedAt" desc nulls last,
        "updatedAt" desc,
        id desc
      limit 1
      `,
      vendorId,
    );

    const assessmentRun = assessmentRunRows?.[0] ?? null;

    const submittedAssessment = await prisma.assessment.findFirst({
      where: {
        vendorId,
        status: {
          in: ["SUBMITTED", "REVIEW_READY"],
        },
      },
      orderBy: {
        submittedAt: "desc",
      },
      include: {
        answers: {
          include: {
            question: true,
          },
          orderBy: {
            updatedAt: "desc",
          },
        },
        template: true,
      },
    });

    const assessmentAnswerRowsForFindings: any[] = await prisma.$queryRawUnsafe(
      `
      select
        aa.id,
        aa."assessmentId",
        aa."questionId",
        aa.value,
        aa."valueJson",
        aa."riskImpact",
        q.text as "questionText",
        q.description as "questionDescription",
        q.category as "questionCategory"
      from "AssessmentAnswer" aa
      join "Assessment" a on a.id = aa."assessmentId"
      left join "AssessmentQuestion" q on q.id = aa."questionId"
      where a."vendorId" = $1
        and a."organizationId" = $2
        and upper(a.status::text) in ('SUBMITTED','REVIEW_READY')
      order by
        a."submittedAt" desc nulls last,
        a.id desc,
        aa.id asc
      limit 250
      `,
      vendor.id,
      vendor.organizationId,
    ).then((rows) =>
      (rows as any[]).map((row) => ({
        id: row.id,
        assessmentId: row.assessmentId,
        questionId: row.questionId,
        value: row.value,
        valueJson: row.valueJson,
        riskImpact: row.riskImpact,
        question: {
          text: row.questionText,
          description: row.questionDescription,
          category: row.questionCategory,
        },
      })),
    );

    const submittedAnswerCount =
      assessmentAnswerRowsForFindings.length ||
      submittedAssessment?.answers?.length ||
      0;

    const submittedAnswerSummary =
      submittedAssessment?.answers
        ?.map((answer) => {
          const prompt =
            answer.question?.text ||
            answer.question?.description ||
            `Question #${answer.questionId}`;

          const value =
            typeof answer.value === "string"
              ? answer.value
              : answer.value == null
                ? "No answer provided"
                : JSON.stringify(answer.value);

          return `- ${prompt}: ${value}`;
        })
        .join("\n") || "No submitted questionnaire answers were found.";

    const existingRows: any[] = await prisma.$queryRawUnsafe(
      `
      select *
      from "ReviewResponse"
      where "reviewAssignmentId" = $1
      order by "updatedAt" desc
      limit 1
      `,
      assignmentId,
    );

    const existing = existingRows?.[0] ?? null;

    const existingResponses =
      existing?.responses && typeof existing.responses === "object"
        ? existing.responses
        : {};

    const existingReleaseState = upper(existingResponses.releaseState);

    if (
      existingReleaseState === "RELEASED" ||
      existingReleaseState === "CONFIRMED"
    ) {
      return json(409, {
        ok: false,
        error:
          existingReleaseState === "CONFIRMED"
            ? "Confirmed Truvern outcomes are locked."
            : "Released Truvern outcomes are awaiting customer confirmation and cannot be regenerated.",
      });
    }

    const riskLevel = inferRiskLevel(vendor, assessmentRun);
    const decision = inferDecision(riskLevel);
    const nowIso = new Date().toISOString();

    const fallbackFindingsText = [
      buildFindings({
        vendor,
        assessmentRun: submittedAssessment || assessmentRun,
        riskLevel,
        decision,
      }),
      "",
      "SUBMITTED QUESTIONNAIRE REVIEW",
      "",
      `Assessment ID: ${submittedAssessment?.id ?? "Not linked"}`,
      `Submitted answers reviewed: ${submittedAnswerCount}`,
      "",
      submittedAnswerSummary,
    ].join("\n");

    console.log("FINDINGS ENGINE INPUT");
    console.dir(assessmentAnswerRowsForFindings.slice(0, 20), { depth: 4 });

    const responseDrivenFindingsV2 = buildResponseDrivenFindingsV2(
      {
        ...(submittedAssessment || {}),
        answers: assessmentAnswerRowsForFindings.length
          ? assessmentAnswerRowsForFindings
          : submittedAssessment?.answers || [],
      },
      fallbackFindingsText,
    );

    console.log("FINDINGS ENGINE OUTPUT");
    console.dir(responseDrivenFindingsV2, { depth: 4 });

    const generatedDraft = {
      schema: "truvern.vendor_review_response.v1",
      ...existingResponses,
      intent: "SAVE_DRAFT",
      assignmentType: "TRUVERN",
      decision,
      riskLevel,
      releaseState: "DRAFT",
      structuredAssessment: {
        executiveSummary: [
          `${vendor.name} completed a Truvern governance assessment review for operational, security, and vendor risk evaluation.`,
          ``,
          `Decision: ${decision}`,
          `Residual risk assessment: ${riskLevel}`,
        ].join("\n"),

        vendorOverview: {
          vendorName: vendor.name,
          category: vendor.category,
          criticality: vendor.criticality,
          vendorRiskScore: vendor.riskScore,
          vendorStatus: vendor.status,
        },

        assessmentScope: {
          assessmentStatus:
            submittedAssessment?.status ?? assessmentRun?.status ?? "REVIEW",
          assessmentCompletedAt:
            submittedAssessment?.submittedAt ?? assessmentRun?.completedAt ?? null,
          assessmentId:
            submittedAssessment?.id ?? null,
          assessmentRunId:
            assessmentRun?.id ?? null,
          submittedAnswerCount,
        },

        questionnaireReview: {
          assessmentId: submittedAssessment?.id ?? null,
          status: submittedAssessment?.status ?? null,
          submittedAt: submittedAssessment?.submittedAt ?? null,
          answerCount: submittedAnswerCount,
          answersReviewed: submittedAnswerSummary,
        },

        evidenceReviewed: [
          "Vendor review submission",
          `Submitted questionnaire answers (${submittedAnswerCount})`,
          "Operational metadata",
          "Vendor profile context",
          "Available evidence artifacts",
          "Risk evaluation indicators",
        ],

        riskAnalysis: {
          residualRisk: riskLevel,
          governanceDecision: decision,
          observations: [
            `Vendor submitted ${submittedAnswerCount} questionnaire answer${submittedAnswerCount === 1 ? "" : "s"} for governance review.`,
            "Vendor operational posture aligns with submitted assessment information.",
            "No immediate critical governance blockers were identified during review.",
            "Residual risk classification reflects currently available evidence and assessment context.",
          ],
        },

        governanceRecommendation: {
          recommendation: decision,
          releaseReady: true,
          requiresCustomerConfirmation: true,
        },

        conditionsAndFollowUps: [
          "Continue periodic governance monitoring.",
          "Maintain evidence and operational control documentation.",
          "Notify customers of material operational or security changes when applicable.",
        ],

        finalAssessment: [
          `This assessment was reviewed through Truvern governance workflows using submitted assessment materials, vendor operational context, evidence documentation, and risk evaluation procedures.`,
          ``,
          `Submitted questionnaire answers reviewed: ${submittedAnswerCount}.`,
          ``,
          `Based on the available assessment information and governance review process, Truvern determined that the current recommendation and residual risk classification accurately reflect the vendor's present operational and risk posture.`,
          ``,
          `This assessment outcome is prepared for governance release and customer consumption.`,
        ].join("\n"),
      },

findings: responseDrivenFindingsV2.findingsText,
      generatedBy: "TRUVERN_FINDINGS_ENGINE",
      intelligenceMode: responseDrivenFindingsV2.intelligenceMode,
      responseDrivenFindingsV2: responseDrivenFindingsV2.responseDrivenFindings,
      assessmentAnswerRowsForFindingsCount: assessmentAnswerRowsForFindings.length,
      draftGeneratedAt: nowIso,
      savedAt: nowIso,
      requiresHumanReview: true,
      automation: {
        engine: "TRUVERN_FINDINGS_ENGINE",
        version: "heuristic.v1",
        generatedAt: nowIso,
        source: "review_desk_generate_draft",
        assessmentRunId: assessmentRun?.id ?? null,
      assessmentId: submittedAssessment?.id ?? null,
      submittedAnswerCount,
        vendorId: vendor.id,
        humanReviewRequired: true,
      },
      completedAt: null,
      releasedAt: null,
    };

    let responseId: number | null = null;

    const storedGeneratedResponses = {
      ...generatedDraft,
      intelligenceMode: responseDrivenFindingsV2.intelligenceMode,
      responseDrivenFindingsV2: responseDrivenFindingsV2.responseDrivenFindings,
      assessmentAnswerRowsForFindingsCount: assessmentAnswerRowsForFindings.length,
      truvernReviewerIntelligence: {
        ...(generatedDraft as any).truvernReviewerIntelligence,
        source: responseDrivenFindingsV2.intelligenceMode,
        responseDrivenFindingsV2: responseDrivenFindingsV2.responseDrivenFindings,
        assessmentAnswerRowsForFindingsCount: assessmentAnswerRowsForFindings.length,
      },
      generatedDraft,
    };

    if (existing?.id) {
      const updatedRows: any[] = await prisma.$queryRawUnsafe(
        `
        update "ReviewResponse"
        set
          responses = $1::jsonb,
          "draftSavedAt" = now(),
          "updatedAt" = now()
        where id = $2
        returning id
        `,
        JSON.stringify(storedGeneratedResponses),
        existing.id,
      );

      responseId = updatedRows?.[0]?.id ?? existing.id;
    } else {
      const insertedRows: any[] = await prisma.$queryRawUnsafe(
        `
        insert into "ReviewResponse" (
          "organizationId",
          "reviewRequestId",
          "reviewAssignmentId",
          responses,
          "draftSavedAt",
          "createdAt",
          "updatedAt"
        )
        values (
  $1,
  $2,
  $3,
  $4::jsonb,
  now(),
  now(),
  now()
)
        returning id
        `,
        vendor.organizationId,
reviewRequestId,
assignmentId,
JSON.stringify(storedGeneratedResponses),
      );

      responseId = insertedRows?.[0]?.id ?? null;
    }

    await prisma.$executeRawUnsafe(
      `
      update "ReviewAssignment"
      set
        status = 'IN_PROGRESS',
        "updatedAt" = now()
      where id = $1
      `,
      assignmentId,
    );

    return json(200, {
      ok: true,
      responseId,
      assignmentId,
      vendorId: vendor.id,
      assessmentRunId: assessmentRun?.id ?? null,
      assessmentId: submittedAssessment?.id ?? null,
      submittedAnswerCount,
      releaseState: "DRAFT",
      decision,
      riskLevel,
      generatedBy: "TRUVERN_FINDINGS_ENGINE",
      requiresHumanReview: true,
    });
  } catch (error: any) {
    return json(500, {
      ok: false,
      error: safeStr(error?.message) || "Failed to generate draft.",
    });
  }
}
































