import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = {
  params: Promise<{ id: string }> | { id: string };
};

function safeStr(value: unknown) {
  return String(value ?? "").trim();
}

function safeJson(value: unknown): any {
  if (!value) return {};
  if (typeof value === "object") return value;
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return {};
    }
  }
  return {};
}

function normalizeKind(input: unknown) {
  const value = safeStr(input).toUpperCase();

  if (value.includes("SOC")) return "SOC2";
  if (value.includes("ISO")) return "ISO27001";
  if (value.includes("POLICY") || value.includes("PROCEDURE")) return "POLICY";
  if (value.includes("PEN") || value.includes("PENTEST")) return "PEN_TEST";
  if (value.includes("BCP") || value.includes("DR") || value.includes("DISASTER")) return "BCP_DRP";
  if (value.includes("DPIA") || value.includes("PRIVACY")) return "DPIA";

  return "OTHER";
}

function findingTitleCore(value: string) {
  return safeStr(value)
    .replace(/^vendor must resolve:\s*/i, "")
    .replace(/^[A-Z0-9- /]+:\s*/i, "")
    .replace(/\.$/, "")
    .trim()
    .toLowerCase();
}

async function cancelSiblingAutoRequests(
  vendorId: number,
  keepEvidenceRequestId: number,
  packageTitle: string,
) {
  const core = findingTitleCore(packageTitle);
  if (!core) return;

  await prisma.$executeRawUnsafe(
    `
    update "EvidenceRequest"
    set
      status = 'CANCELLED'::"EvidenceRequestStatus",
      notes = coalesce(notes, '') || ' | Superseded by grouped remediation package.',
      "updatedAt" = now()
    where "vendorId" = $1
      and id <> $2
      and status::text = 'REQUESTED'
      and notes like 'Auto-created by Truvern Findings Engine%'
      and (
        lower(title) = $3
        or lower(title) like '%' || $3 || '%'
        or lower(title) like 'vendor must resolve:%' || $3 || '%'
      )
    `,
    vendorId,
    keepEvidenceRequestId,
    core,
  );
}
const CONTROL_TRANSLATIONS: Record<string, { title: string; reason: string }> = {
  "AC-2": {
    title: "Document how user accounts are managed",
    reason: "We need evidence that user accounts are created, reviewed, modified, and removed through a controlled process.",
  },
  "IA-2": {
    title: "Show how accounts are protected with multi-factor authentication",
    reason: "We need evidence that important accounts are protected from unauthorized access.",
  },
  "CM-3": {
    title: "Document how system changes are managed",
    reason: "We need evidence that system changes are reviewed, approved, tested, and tracked.",
  },
  "SI-2": {
    title: "Show how vulnerabilities are identified and remediated",
    reason: "We need evidence that security issues are tracked and remediated within a defined process.",
  },
  "CA-2": {
    title: "Provide evidence of security assessment activities",
    reason: "We need evidence that your security controls are periodically reviewed or tested.",
  },
  "PL-2": {
    title: "Upload your information security policy",
    reason: "We need evidence that your security expectations and governance practices are documented.",
  },
  "PM-9": {
    title: "Describe how security governance responsibilities are assigned",
    reason: "We need evidence that security responsibilities are assigned to appropriate owners.",
  },
  "IR-4": {
    title: "Document your incident response process",
    reason: "We need evidence that security incidents are identified, escalated, handled, and reviewed through a documented process.",
  },
  "CP-2": {
    title: "Provide your business continuity and disaster recovery plans",
    reason: "We need evidence that your organization can continue or recover critical operations during disruption.",
  },
  "AU-6": {
    title: "Show how security logs are reviewed",
    reason: "We need evidence that security logs and monitoring alerts are reviewed and escalated when needed.",
  },
};

function mappedControlsFromText(value: string) {
  return Array.from(
    new Set(
      safeStr(value)
        .match(/\b[A-Z]{2}-\d+(?:\([a-z0-9]+\))?\b/g) ?? [],
    ),
  );
}

function vendorTitleForPlan(title: string, evidence: string[]) {
  const controls = mappedControlsFromText(`${title} ${evidence.join(" ")}`);
  const translated = controls.map((control) => CONTROL_TRANSLATIONS[control]?.title).filter(Boolean);

  if (translated.length === 1) return translated[0];

  if (translated.some((item) => item.toLowerCase().includes("incident response"))) {
    return "Document your incident response process";
  }

  if (translated.some((item) => item.toLowerCase().includes("vulnerabilities"))) {
    return "Show how vulnerabilities are identified and remediated";
  }

  if (translated.some((item) => item.toLowerCase().includes("security policy"))) {
    return "Provide your security policy and governance documentation";
  }

  if (translated.length > 1) {
    return translated[0];
  }

  return safeStr(title)
    .replace(/^vendor must resolve:\s*/i, "")
    .replace(/^[A-Z0-9- /]+:\s*/i, "")
    .replace(/\b[A-Z]{2}-\d+(?:\([a-z0-9]+\))?\b/g, "")
    .replace(/[:/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim() || "Provide remediation evidence requested by Truvern";
}

function vendorSummaryForPlan(title: string, evidence: string[]) {
  const controls = mappedControlsFromText(`${title} ${evidence.join(" ")}`);
  const reasons = controls.map((control) => CONTROL_TRANSLATIONS[control]?.reason).filter(Boolean);

  if (reasons.length > 0) return Array.from(new Set(reasons)).join(" ");

  return "Truvern could not verify this control area from the submitted questionnaire and needs additional evidence before the review can be completed.";
}
function packageSourceKey(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 180);
}

function dueDateFor(plan: any) {
  const severity = safeStr(plan?.severity ?? plan?.riskLevel ?? plan?.risk).toUpperCase();
  const days =
    severity.includes("CRITICAL") || severity.includes("HIGH")
      ? 7
      : severity.includes("MEDIUM")
        ? 14
        : 30;

  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

function asArray(value: unknown) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function normalizePlan(plan: any, index: number) {
  if (typeof plan === "string") {
    return {
      title: plan,
      description: "Truvern generated this remediation follow-up from the assessment findings.",
      kind: "OTHER",
      dueAt: dueDateFor({}),
    };
  }

  const title =
    safeStr(plan?.title) ||
    safeStr(plan?.findingTitle) ||
    safeStr(plan?.control) ||
    safeStr(plan?.controlId) ||
    `Truvern remediation request ${index + 1}`;

  const evidence = [
    ...asArray(plan?.requiredEvidence),
    ...asArray(plan?.evidence),
    ...asArray(plan?.evidenceItems),
  ];

  const attestations = [
    ...asArray(plan?.requiredAttestation),
    ...asArray(plan?.requiredAttestations),
    ...asArray(plan?.attestations),
  ];

  const description = [
    safeStr(plan?.recommendation) ? `Recommendation: ${safeStr(plan.recommendation)}` : "",
    safeStr(plan?.releaseImpact) ? `Release impact: ${safeStr(plan.releaseImpact)}` : "",
    evidence.length ? `Required evidence:\n${evidence.map((x) => `- ${safeStr(x)}`).join("\n")}` : "",
    attestations.length ? `Required attestations:\n${attestations.map((x) => `- ${safeStr(x)}`).join("\n")}` : "",
    safeStr(plan?.evidenceSignal) ? `Evidence signal: ${safeStr(plan.evidenceSignal)}` : "",
  ].filter(Boolean).join("\n\n");

  return {
    title,
    sourceKey: packageSourceKey(title),
    description: description || "Truvern generated this remediation request from vendor assessment findings.",
    kind: normalizeKind(`${title} ${plan?.kind ?? ""} ${plan?.control ?? ""} ${plan?.controlFamily ?? ""}`),
    severity: safeStr(plan?.severity ?? plan?.riskLevel ?? plan?.risk) || null,
    dueAt: dueDateFor(plan),
    requiredEvidence: evidence.map(safeStr).filter(Boolean),
    requiredAttestation: attestations.map(safeStr).filter(Boolean),
    recommendation: safeStr(plan?.recommendation),
    releaseImpact: safeStr(plan?.releaseImpact) || "Release blocked pending remediation or attestation review.",
    evidenceSignal: safeStr(plan?.evidenceSignal),
    raw: plan,
  };
}

function splitListText(value: string) {
  return value
    .split(/[,;\n]+/)
    .map((item) => safeStr(item).replace(/^[-•]\s*/, ""))
    .filter(Boolean);
}

function mergePlanDetails(target: any, source: any) {
  const evidence = [
    ...asArray(target.requiredEvidence),
    ...asArray(source?.requiredEvidence),
    ...asArray(source?.evidence),
    ...asArray(source?.evidenceItems),
  ];

  const attestations = [
    ...asArray(target.requiredAttestation),
    ...asArray(source?.requiredAttestation),
    ...asArray(source?.requiredAttestations),
    ...asArray(source?.attestations),
  ];

  return {
    ...target,
    ...source,
    title: safeStr(target?.title) || safeStr(source?.title),
    requiredEvidence: Array.from(new Set(evidence.map(safeStr).filter(Boolean))),
    requiredAttestation: Array.from(new Set(attestations.map(safeStr).filter(Boolean))),
    recommendation: safeStr(target?.recommendation) || safeStr(source?.recommendation),
    releaseImpact: safeStr(target?.releaseImpact) || safeStr(source?.releaseImpact),
    evidenceSignal: safeStr(target?.evidenceSignal) || safeStr(source?.evidenceSignal),
  };
}

function extractPlans(responses: any) {
  const primaryPools = [
    responses?.truvernRemediation?.plans,
    responses?.structuredAssessment?.truvernRemediation?.plans,
    responses?.generatedDraft?.structuredAssessment?.truvernRemediation?.plans,
    responses?.remediationPlans,
  ];

  const primary = primaryPools.flatMap(asArray);

  if (primary.length > 0) {
    const seen = new Set<string>();

    return primary
      .map((plan, index) => normalizePlan(plan, index))
      .filter((plan) => {
        const key = plan.title.toLowerCase();
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }

  const fallback = [
    ...asArray(responses?.conditionsAndFollowUps),
    ...asArray(responses?.structuredAssessment?.conditionsAndFollowUps),
  ];

  const grouped: any[] = [];
  let current: any = null;

  for (const item of fallback) {
    const rawTitle =
      typeof item === "string"
        ? item
        : safeStr(item?.title ?? item?.findingTitle ?? item?.control ?? item?.controlId);

    const text = safeStr(rawTitle);
    const lower = text.toLowerCase();

    const isParentFinding =
      lower.includes("governance gap") ||
      lower.startsWith("vendor must resolve:") ||
      lower.startsWith("resolve:");

    const isEvidenceLine = lower.startsWith("required evidence:");
    const isAttestationLine =
      lower.startsWith("required attestation:") ||
      lower.startsWith("required attestations:");

    if (isParentFinding) {
      const cleanTitle = text
        .replace(/^vendor must resolve:\s*/i, "")
        .replace(/^resolve:\s*/i, "")
        .trim();

      current = typeof item === "object" && item
        ? { ...item, title: cleanTitle || text }
        : { title: cleanTitle || text };

      grouped.push(current);
      continue;
    }

    if ((isEvidenceLine || isAttestationLine) && current) {
      const cleaned = text
        .replace(/^required evidence:\s*/i, "")
        .replace(/^required attestations?:\s*/i, "")
        .trim();

      if (isEvidenceLine) {
        current.requiredEvidence = [
          ...asArray(current.requiredEvidence),
          ...splitListText(cleaned),
        ];
      }

      if (isAttestationLine) {
        current.requiredAttestation = [
          ...asArray(current.requiredAttestation),
          ...splitListText(cleaned),
        ];
      }

      continue;
    }

    if (current && lower.includes("reviewer validation")) {
      current.requiredAttestation = [
        ...asArray(current.requiredAttestation),
        "Reviewer validation before governance release",
      ];
      continue;
    }

    // Keep generic operational follow-ups out of vendor remediation packages.
    if (
      lower.startsWith("continue ") ||
      lower.startsWith("maintain ") ||
      lower.startsWith("notify customers")
    ) {
      continue;
    }

    if (typeof item === "object" && item) {
      current = mergePlanDetails(current || {}, item);
      if (!grouped.includes(current)) grouped.push(current);
    }
  }

  const seen = new Set<string>();
  return grouped
    .map((plan, index) => normalizePlan(plan, index))
    .filter((plan) => {
      const key = plan.title.toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export async function POST(_req: Request, props: Props) {
  try {
    const { userId } = await auth();
    const resolved = await props.params;
    const assignmentId = Number(resolved?.id);

    if (!Number.isFinite(assignmentId) || assignmentId <= 0) {
      return NextResponse.json({ ok: false, error: "Assignment id required." }, { status: 400 });
    }

    const rows: any[] = await prisma.$queryRawUnsafe(
      `
      select
        ra.id as "assignmentId",
        ra."vendorId",
        ra."organizationId",
        rr.responses
      from "ReviewAssignment" ra
      left join lateral (
        select responses
        from "ReviewResponse"
        where "reviewAssignmentId" = ra.id
        order by "updatedAt" desc nulls last, id desc
        limit 1
      ) rr on true
      where ra.id = $1
      limit 1
      `,
      assignmentId,
    );

    const row = rows?.[0];

    if (!row) {
      return NextResponse.json({ ok: false, error: "Review assignment not found." }, { status: 404 });
    }

    const responses = safeJson(row.responses);
    const plans = extractPlans(responses);

    if (plans.length === 0) {
      return NextResponse.json({
        ok: true,
        createdCount: 0,
        skippedCount: 0,
        message: "No generated remediation plans found.",
      });
    }

    const created: number[] = [];
    const skipped: string[] = [];

    for (const plan of plans) {
      const existing: any[] = await prisma.$queryRawUnsafe(
        `
        select id
        from "EvidenceRequest"
        where "vendorId" = $1
          and "organizationId" = $2
          and lower(coalesce(title, label)) = lower($3)
          and upper(coalesce(status::text, '')) <> 'CANCELLED'
        limit 1
        `,
        Number(row.vendorId),
        Number(row.organizationId),
        plan.title,
      );

      const packageRows: any[] = await prisma.$queryRawUnsafe(
        `
        insert into "RemediationPackage" (
          "reviewAssignmentId",
          "vendorId",
          "organizationId",
          "sourceKey",
          title,
          status,
          severity,
          "dueAt",
          payload,
          "createdAt",
          "updatedAt"
        )
        values (
          $1,
          $2,
          $3,
          $4,
          $5,
          'REQUESTED',
          $6,
          $7,
          $8::jsonb,
          now(),
          now()
        )
        on conflict ("reviewAssignmentId", "sourceKey")
        do update set
          title = excluded.title,
          severity = excluded.severity,
          "dueAt" = excluded."dueAt",
          payload = excluded.payload,
          "updatedAt" = now()
        returning id
        `,
        assignmentId,
        Number(row.vendorId),
        Number(row.organizationId),
        plan.sourceKey,
        plan.title,
        plan.severity,
        plan.dueAt,
        JSON.stringify({
          title: plan.title,
          summary: plan.description,
          requiredEvidence: plan.requiredEvidence,
          requiredAttestations: plan.requiredAttestation,
          recommendation: plan.recommendation,
          releaseImpact: plan.releaseImpact,
          evidenceSignal: plan.evidenceSignal,
          severity: plan.severity,
        }),
      );
      if (existing.length > 0) {
        const existingRequestId = Number(existing[0].id);

        await prisma.$executeRawUnsafe(
          `
          update "RemediationPackage"
          set "evidenceRequestId" = $1, "updatedAt" = now()
          where id = $2
          `,
          existingRequestId,
          Number(packageRows?.[0]?.id),
        );

        skipped.push(plan.title);
        continue;
      }

      const inserted: any[] = await prisma.$queryRawUnsafe(
        `
        insert into "EvidenceRequest" (
          "vendorId",
          "organizationId",
          "requestedBy",
          kind,
          label,
          title,
          description,
          "dueAt",
          status,
          "requestedAt",
          notes,
          "createdAt",
          "updatedAt"
        )
        values (
          $1,
          $2,
          $3,
          $4::"EvidenceRequestKind",
          $5,
          $6,
          $7,
          $8,
          'REQUESTED'::"EvidenceRequestStatus",
          now(),
          'Auto-created by Truvern Findings Engine.',
          now(),
          now()
        )
        returning id
        `,
        Number(row.vendorId),
        Number(row.organizationId),
        userId || "truvern-findings-engine",
        plan.kind,
        plan.title.slice(0, 240),
        plan.title,
        plan.description,
        plan.dueAt,
      );

      if (inserted?.[0]?.id) {
        const evidenceRequestId = Number(inserted[0].id);
        created.push(evidenceRequestId);

        await prisma.$executeRawUnsafe(
          `
          update "RemediationPackage"
          set "evidenceRequestId" = $1, "updatedAt" = now()
          where id = $2
          `,
          evidenceRequestId,
          Number(packageRows?.[0]?.id),
        );
      }
    }

    return NextResponse.json({
      ok: true,
      createdCount: created.length,
      createdIds: created,
      skippedCount: skipped.length,
      skipped,
      message: `Published ${created.length} generated remediation request(s).`,
    });
  } catch (error: any) {
    console.error("Auto-publish remediation failed:", error);
    return NextResponse.json(
      { ok: false, error: safeStr(error?.message) || "Failed to publish remediation requests." },
      { status: 500 },
    );
  }
}








