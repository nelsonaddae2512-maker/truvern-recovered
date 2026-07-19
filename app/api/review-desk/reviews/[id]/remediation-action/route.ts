import { NextResponse } from "next/server";
import { requireReviewerAccess } from "@/lib/auth/truvern-governance";
import prisma from "@/lib/prisma";

type RouteContext = {
  params: Promise<{
    id?: string;
  }>;
};

function safeInt(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function safeArray(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

function normalize(value: unknown) {
  return cleanText(value).toLowerCase();
}

function matchesPlan(plan: any, findingId: string, title: string) {
  const targetFinding = normalize(findingId);
  const targetTitle = normalize(title);

  const candidates = [
    plan?.id,
    plan?.findingId,
    plan?.title,
    plan?.control,
  ]
    .map(normalize)
    .filter(Boolean);

  return candidates.some((candidate) => {
    return (
      candidate === targetFinding ||
      candidate === targetTitle ||
      (!!targetFinding && candidate.includes(targetFinding)) ||
      (!!targetTitle && candidate.includes(targetTitle)) ||
      (!!targetFinding && targetFinding.includes(candidate)) ||
      (!!targetTitle && targetTitle.includes(candidate))
    );
  });
}

function isReleaseBlocked(plans: any[]) {
  return plans.some((plan) => {
    const status = normalize(plan?.status).toUpperCase();
    const evidenceStatus = normalize(plan?.evidenceStatus).toUpperCase();
    const attestationStatus = normalize(plan?.attestationStatus).toUpperCase();
    const requiredAttestations = safeArray(plan?.requiredAttestation);

    if (status !== "APPROVED") return true;
    if (evidenceStatus !== "APPROVED") return true;
    if (requiredAttestations.length > 0 && attestationStatus !== "APPROVED") return true;

    return false;
  });
}

export async function POST(request: Request, context: RouteContext) {
  await requireReviewerAccess();
  const params = await context.params;
  const assignmentId = safeInt(params?.id);

  if (!assignmentId) {
    return NextResponse.json(
      { ok: false, error: "Invalid assignment id." },
      { status: 400 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const action = cleanText(body?.action).toUpperCase();
  const findingId = cleanText(body?.findingId);
  const title = cleanText(body?.title);

  if (!action || (!findingId && !title)) {
    return NextResponse.json(
      { ok: false, error: "Missing remediation action target." },
      { status: 400 },
    );
  }

  if (
    action !== "REQUEST_EVIDENCE" &&
    action !== "REQUEST_ATTESTATION" &&
    action !== "APPROVE_REMEDIATION" &&
    action !== "REJECT_REMEDIATION" &&
    action !== "REOPEN_REMEDIATION"
  ) {
    return NextResponse.json(
      { ok: false, error: "Unsupported remediation action." },
      { status: 400 },
    );
  }

  const rows: any[] = await prisma.$queryRawUnsafe(
    `
    select
      rr.id,
      rr.responses,
      ra."vendorId",
      v."organizationId"
    from "ReviewResponse" rr
    join "ReviewAssignment" ra
      on ra.id = rr."reviewAssignmentId"
    left join "Vendor" v
      on v.id = ra."vendorId"
    where rr."reviewAssignmentId" = $1
    order by rr."updatedAt" desc, rr.id desc
    limit 1
    `,
    assignmentId,
  );

  const row = rows?.[0];

  if (!row) {
    return NextResponse.json(
      { ok: false, error: "Review response not found." },
      { status: 404 },
    );
  }

  const responses =
    row.responses && typeof row.responses === "object" ? row.responses : {};

  const remediation =
    responses.truvernRemediation &&
    typeof responses.truvernRemediation === "object"
      ? responses.truvernRemediation
      : {};

  const plans = safeArray(remediation.plans);
  const now = new Date().toISOString();

  let changed = false;

  const updatedPlans = plans.map((plan: any) => {
    if (!matchesPlan(plan, findingId, title)) return plan;

    changed = true;

    if (action === "REQUEST_EVIDENCE") {
      return {
        ...plan,
        status: cleanText(plan?.status) || "OPEN",
        evidenceStatus: "REQUESTED",
        blockerStatus: "OPEN",
        evidenceRequestedAt: now,
      };
    }

    if (action === "REQUEST_ATTESTATION") {
      return {
        ...plan,
        status: cleanText(plan?.status) || "OPEN",
        attestationStatus: "REQUESTED",
        blockerStatus: "OPEN",
        attestationRequestedAt: now,
      };
    }

    if (action === "APPROVE_REMEDIATION") {
      return {
        ...plan,
        status: "APPROVED",
        evidenceStatus: "APPROVED",
        attestationStatus:
          safeArray(plan?.requiredAttestation).length > 0
            ? "APPROVED"
            : "NOT_REQUIRED",
        blockerStatus: "CLOSED",
        approvedAt: now,
      };
    }

    if (action === "REJECT_REMEDIATION") {
      return {
        ...plan,
        status: "REJECTED",
        blockerStatus: "OPEN",
        rejectedAt: now,
      };
    }

    if (action === "REOPEN_REMEDIATION") {
      return {
        ...plan,
        status: "OPEN",
        evidenceStatus: "REQUESTED",
        attestationStatus: safeArray(plan?.requiredAttestation).length > 0
          ? "REQUESTED"
          : "NOT_REQUIRED",
        blockerStatus: "OPEN",
        reopenedAt: now,
      };
    }

    return plan;
  });

  if (!changed) {
    return NextResponse.json(
      {
        ok: false,
        error: "Matching remediation plan not found.",
        findingId,
        title,
        planTargets: plans.map((plan: any) => ({
          id: plan?.id ?? null,
          findingId: plan?.findingId ?? null,
          title: plan?.title ?? null,
          control: plan?.control ?? null,
        })),
      },
      { status: 404 },
    );
  }

  const requestEntry =
    action === "REQUEST_EVIDENCE" || action === "REQUEST_ATTESTATION"
      ? [
          {
            type: action,
            findingId,
            title,
            status: "OPEN",
            requestedAt: now,
          },
        ]
      : [];

  const blocked = isReleaseBlocked(updatedPlans);

  const updatedResponses = {
    ...responses,
    releaseBlocked: blocked,
    releaseState: blocked ? "BLOCKED" : "READY_FOR_RELEASE",
    truvernRemediation: {
      ...remediation,
      plans: updatedPlans,
      requests: [...safeArray(remediation.requests), ...requestEntry],
      history: [
        ...safeArray(remediation.history),
        {
          event: action,
          findingId,
          title,
          createdAt: now,
        },
      ],
      updatedAt: now,
    },
  };

  await prisma.$executeRawUnsafe(
    `
    update "ReviewResponse"
    set responses = $1::jsonb,
        "updatedAt" = now()
    where id = $2
    `,
    JSON.stringify(updatedResponses),
    row.id,
  );

  if (action === "REQUEST_EVIDENCE") {
    const matchedPlan = updatedPlans.find((plan: any) => matchesPlan(plan, findingId, title));
    const vendorId = Number(row?.vendorId);
    const organizationId = Number(row?.organizationId);
    const dueAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

    if (Number.isFinite(vendorId) && vendorId > 0 && Number.isFinite(organizationId) && organizationId > 0) {
      const requiredEvidence = safeArray(matchedPlan?.requiredEvidence)
        .map((item: any) => cleanText(item))
        .filter(Boolean);

      for (const item of requiredEvidence) {
        const reviewNote = `Review assignment #${assignmentId}. Finding: ${matchedPlan?.title ?? title}`;

        const existing: any[] = await prisma.$queryRawUnsafe(
          `
          select id
          from "EvidenceRequest"
          where "vendorId" = $1
            and "organizationId" = $2
            and title = $3
            and coalesce("reviewNote", '''') = $4
            and status::text in ('REQUESTED', 'FULFILLED')
          limit 1
          `,
          vendorId,
          organizationId,
          item,
          reviewNote,
        );

        if (existing.length > 0) {
          continue;
        }

        await prisma.$executeRawUnsafe(
          `
          insert into "EvidenceRequest" (
            "vendorId",
            "organizationId",
            kind,
            title,
            notes,
            "dueAt",
            status,
            "createdAt",
            "updatedAt",
            "reviewNote"
          )
          values (
            $1,
            $2,
            'OTHER'::"EvidenceRequestKind",
            $3,
            $4,
            $5,
            'REQUESTED'::"EvidenceRequestStatus",
            now(),
            now(),
            $6
          )
          `,
          vendorId,
          organizationId,
          item,
          `Generated from Truvern remediation plan: ${matchedPlan?.title ?? title}`,
          dueAt,
          reviewNote,
        );
      }
    }
  }

  return NextResponse.json({
    ok: true,
    action,
    releaseBlocked: blocked,
    releaseState: updatedResponses.releaseState,
  });
}









