import { auth } from "@clerk/nextjs/server";
import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  canLaunchGovernanceTemplate,
  governanceTemplateGateMessage,
} from "@/lib/governance/template-access";
import { getCurrentOrgPlanTier } from "@/lib/billing/plan-access";
import {
  createNotification,
  createOrgNotification,
} from "@/lib/notifications/create-notification";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type OrgJsonRow = {
  orgJson: Record<string, unknown> | null;
};

type TruvernEntitlement = {
  allowed: boolean;
  reason: "credits" | "eligible_plan" | "override" | "insufficient";
  requiredCredits: number;
  availableCredits: number;
  reservedCredits: number;
  consumedCredits: number;
  eligiblePlan: string | null;
};

function safeInt(v: unknown) {
  const n = Number(String(v ?? "").trim());
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

function safeMode(v: unknown): "internal" | "truvern" | null {
  const s = String(v ?? "").trim().toLowerCase();
  if (s === "internal" || s === "truvern") return s;
  return null;
}

function reviewCreditCost() {
  return safeInt(process.env.TRUVERN_REVIEW_CREDIT_COST) ?? 1;
}

function json(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

function upper(v: unknown) {
  return String(v ?? "").trim().toUpperCase();
}

function truthy(v: unknown) {
  if (typeof v === "boolean") return v;
  const s = String(v ?? "").trim().toLowerCase();
  return ["true", "1", "yes", "active", "enabled"].includes(s);
}

function parseTruvernOpsUsers() {
  return String(process.env.TRUVERN_OPS_USERS || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function isLikelyClerkUserId(value: string) {
  return value.startsWith("user_");
}
function readFirstString(obj: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }

  return null;
}

function hasActiveOverride(org: Record<string, unknown>) {
  const directOverride =
    truthy(org.truvernOpsOverride) ||
    truthy(org.truvernReviewOverride) ||
    truthy(org.truvernOverride) ||
    truthy(org.reviewOverride) ||
    truthy(org.hasTruvernAccess) ||
    truthy(org.hasTruvernReviewAccess);

  if (directOverride) return true;

  const overrideUntil =
    org.truvernOverrideUntil ??
    org.truvernOpsOverrideUntil ??
    org.truvernReviewOverrideUntil ??
    org.reviewOverrideUntil;

  if (typeof overrideUntil === "string" || overrideUntil instanceof Date) {
    const expiresAt = new Date(overrideUntil);
    if (Number.isFinite(expiresAt.getTime()) && expiresAt > new Date()) {
      return true;
    }
  }

  return false;
}

function resolveEligiblePlan(org: Record<string, unknown>) {
  const plan = upper(
    readFirstString(org, [
      "plan",
      "billingPlan",
      "subscriptionPlan",
      "planTier",
      "tier",
      "accessTier",
      "customerPlan",
      "organizationPlan",
    ]),
  );

  if (plan === "TRUVERN_UNLIMITED") {
    return plan;
  }

  return null;
}

async function getTruvernEntitlement(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  organizationId: number,
): Promise<TruvernEntitlement> {
  const cost = reviewCreditCost();

  const balanceRows: Array<{
    availableCredits: number;
    reservedCredits: number;
    consumedCredits: number;
  }> = await tx.$queryRawUnsafe(
    `
    select
      coalesce(sum("availableDelta"), 0)::int as "availableCredits",
      coalesce(sum("reservedDelta"), 0)::int as "reservedCredits",
      coalesce(sum("consumedDelta"), 0)::int as "consumedCredits"
    from "TruvernCreditLedgerEntry"
    where "organizationId" = $1
      and status::text = 'POSTED'
    `,
    organizationId,
  );

  const balance = balanceRows?.[0];

  const availableCredits = Number(balance?.availableCredits ?? 0);
  const reservedCredits = Number(balance?.reservedCredits ?? 0);
  const consumedCredits = Number(balance?.consumedCredits ?? 0);

  const orgRows = await tx.$queryRaw<OrgJsonRow[]>`
    select to_jsonb(o) as "orgJson"
    from "Organization" o
    where o.id = ${organizationId}
    limit 1
  `;

  const org = orgRows[0]?.orgJson ?? {};
  const eligiblePlan = resolveEligiblePlan(org);
  const override = hasActiveOverride(org);

  if (availableCredits >= cost) {
    return {
      allowed: true,
      reason: "credits",
      requiredCredits: cost,
      availableCredits,
      reservedCredits,
      consumedCredits,
      eligiblePlan,
    };
  }

  if (false && eligiblePlan) {
    return {
      allowed: true,
      reason: "eligible_plan",
      requiredCredits: cost,
      availableCredits,
      reservedCredits,
      consumedCredits,
      eligiblePlan,
    };
  }

  if (override) {
    return {
      allowed: true,
      reason: "override",
      requiredCredits: cost,
      availableCredits,
      reservedCredits,
      consumedCredits,
      eligiblePlan,
    };
  }

  return {
    allowed: false,
    reason: "insufficient",
    requiredCredits: cost,
    availableCredits,
    reservedCredits,
    consumedCredits,
    eligiblePlan,
  };
}


function buildVendorAssessmentToken() {
  return randomUUID().replaceAll("-", "");
}

function addDays(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return json(401, {
        ok: false,
        error: "Unauthorized",
      });
    }

    const body = await req.json().catch(() => null);
    const vendorId = safeInt(body?.vendorId);
    const assessmentId = safeInt(body?.assessmentId);
    const mode = safeMode(body?.mode);

    const reviewerUserId =
      typeof body?.reviewerUserId === "string"
        ? body.reviewerUserId.trim()
        : "";

    const assignedReviewerName =
      typeof body?.assignedReviewerName === "string"
        ? body.assignedReviewerName.trim()
        : "";

    if (!vendorId) return json(400, { ok: false, error: "Missing vendorId" });
    if (!mode) return json(400, { ok: false, error: "Missing assignment mode" });

    const acceptedAcknowledgement = body?.acceptedAcknowledgement === true;

    if (mode === "truvern" && !acceptedAcknowledgement) {
      return json(400, {
        ok: false,
        code: "ACKNOWLEDGEMENT_REQUIRED",
        error:
          "Customer acknowledgement acceptance is required for Truvern-Truvern Reviews.",
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      const vendors = await tx.$queryRaw<
        Array<{ id: number; name: string; organizationId: number }>
      >`
        select id, name, "organizationId"
        from "Vendor"
        where id = ${vendorId}
        limit 1
      `;

      const vendor = vendors[0];

      if (!vendor) {
        return { status: 404, body: { ok: false, error: "Vendor not found" } };
      }

      await tx.$executeRawUnsafe(
        `select pg_advisory_xact_lock($1::int, $2::int)`,
        vendor.organizationId,
        vendor.id,
      );

      let entitlement: TruvernEntitlement | null = null;

      if (mode === "truvern") {
        const activeRows: Array<{
          assignmentId: number;
          requestId: number;
          status: string;
        }> = await tx.$queryRawUnsafe(
          `
          select
            ra.id as "assignmentId",
            req.id as "requestId",
            ra.status::text as status
          from "ReviewAssignment" ra
          join "ReviewRequest" req on req.id = ra."reviewRequestId"
          where req."vendorId" = $1
            and req."organizationId" = $2
            and (
              ($3::int is null and req."assessmentId" is null)
              or req."assessmentId" = $3
            )
            and (
              lower(coalesce(ra.note, '')) like '%truvern%'
              or lower(coalesce(req.title, '')) like '%truvern%'
              or lower(coalesce(req.note, '')) like '%truvern%'
            )
            and ra.status::text in ('PENDING', 'IN_PROGRESS')
          order by ra."updatedAt" desc, ra.id desc
          limit 1
          `,
          vendor.id,
          vendor.organizationId,
          assessmentId,
        );

        const active = activeRows[0];

        if (active?.assignmentId && active?.requestId) {
          return {
            status: 200,
            body: {
              ok: true,
              alreadyExists: true,
              requestId: active.requestId,
              assignmentId: active.assignmentId,
              mode,
              redirectUrl: `/vendors/${vendor.id}?managedReview=created&assignmentId=${active.assignmentId}#reviews`,
            },
          };
        }

        entitlement = await getTruvernEntitlement(tx, vendor.organizationId);

        if (!entitlement.allowed) {
          return {
            status: 402,
            body: {
              ok: false,
              code: "TRUVERN_ACCESS_REQUIRED",
              error:
                "Truvern Expert Review requires available Truvern credits or an eligible plan.",
              requiredCredits: entitlement.requiredCredits,
              availableCredits: entitlement.availableCredits,
              reservedCredits: entitlement.reservedCredits,
              consumedCredits: entitlement.consumedCredits,
              eligiblePlan: entitlement.eligiblePlan,
              fundingUrl: "/billing/credits",
            },
          };
        }
      }

      const title =
        mode === "truvern"
          ? `Truvern expert review · ${vendor.name}`
          : `Internal review · ${vendor.name}`;

      const note =
        mode === "truvern"
          ? "Requested from Governance Ops intake."
          : "Started from Governance Ops intake.";

      if (mode === "truvern" && body.acceptedAcknowledgement !== true) {
        return {
          status: 400,
          body: {
            ok: false,
            error:
              "Legal acknowledgement is required before starting a Truvern-Truvern Review.",
          },
        };
      }

      const legalAcknowledgement =
        mode === "truvern"
          ? {
              accepted: true,
              acceptedByUserId: userId,
              acceptedAt: new Date().toISOString(),
              acceptanceVersion: "TRV-LEGAL-1.0",
              statement:
                "Customer acknowledges that Truvern governance outcomes are operational governance assessments and not legal guarantees, certifications, warranties, or regulatory attestations.",
            }
          : null;

      const requests = await tx.$queryRaw<Array<{ id: number }>>`
        insert into "ReviewRequest" ("organizationId", "vendorId", "assessmentId", title, note, status, "updatedAt")
        values (${vendor.organizationId}, ${vendor.id}, ${assessmentId}, ${title}, ${note}, 'REQUESTED'::text, now())
        returning id
      `;

      const request = requests[0];

      if (!request?.id) {
        return {
          status: 500,
          body: { ok: false, error: "Failed to create review request" },
        };
      }

      const hasSelectedReviewer =
        mode === "internal" && Boolean(reviewerUserId) && Boolean(assignedReviewerName);

      const assignmentStatus =
        mode === "truvern"
          ? "PENDING"
          : hasSelectedReviewer
            ? "IN_PROGRESS"
            : "PENDING";

      const assignmentNote =
        mode === "truvern"
          ? "Truvern expert review requested."
          : "Internal review started.";

      const assignments = await tx.$queryRaw<Array<{ id: number }>>`
        insert into "ReviewAssignment" (
          "organizationId",
          "vendorId",
          "reviewRequestId",
          "assignmentType",
          "status",
          "note",
          "reviewerUserId",
          "assignedReviewerName",
          "reviewerName",
          "assignedTo",
          "startedAt",
          "claimedAt",
          "updatedAt"
        )
        values (
          ${vendor.organizationId},
          ${vendor.id},
          ${request.id},
          ${mode === "truvern" ? "TRUVERN" : "INTERNAL"},
          ${assignmentStatus}::text,
          ${assignmentNote},
          ${reviewerUserId || null},
          ${assignedReviewerName || null},
          ${assignedReviewerName || null},
          ${assignedReviewerName || null},
          ${hasSelectedReviewer ? new Date() : null},
          ${hasSelectedReviewer ? new Date() : null},
          now()
        )
        returning id
      `;

      const assignment = assignments[0];

      if (!assignment?.id) {
        return {
          status: 500,
          body: { ok: false, error: "Failed to create review assignment" },
        };
      }

      let reservation: Record<string, unknown> | null = null;

      if (mode === "truvern") {
        const opsUsers = parseTruvernOpsUsers();

        for (const opsUser of opsUsers) {
          await createNotification({
            userId: isLikelyClerkUserId(opsUser) ? opsUser : null,
            organizationId: vendor.organizationId,
            type: "REVIEW_ASSIGNED",
            severity: "INFO",
            title: `New Truvern Truvern Review · ${vendor.name}`,
            message:
              "A vendor was submitted to Truvern Ops for managed governance review.",
            href: `/review-desk/${assignment.id}`,
            metadataJson: {
              vendorId: vendor.id,
              vendorName: vendor.name,
              requestId: request.id,
              assignmentId: assignment.id,
              managedReview: true,
              assignmentType: "TRUVERN",
        reviewerName: "Truvern Review Team",
        assignedReviewerName: "Truvern Review Team",
        assignedTo: "Truvern Review Team",
              opsRecipient: opsUser,
            },
          });
        }

        if (opsUsers.length === 0) {
          await createOrgNotification({
            organizationId: vendor.organizationId,
            type: "REVIEW_ASSIGNED",
            severity: "INFO",
            title: `New Truvern Truvern Review · ${vendor.name}`,
            message:
              "A vendor was submitted to Truvern Ops for managed governance review.",
            href: `/review-desk/${assignment.id}`,
            metadataJson: {
              vendorId: vendor.id,
              vendorName: vendor.name,
              requestId: request.id,
              assignmentId: assignment.id,
              managedReview: true,
              assignmentType: "TRUVERN",
        reviewerName: "Truvern Review Team",
        assignedReviewerName: "Truvern Review Team",
        assignedTo: "Truvern Review Team",
              opsRecipient: "fallback-org-notification",
            },
          });
        }
      }

      if (mode === "truvern" && entitlement) {
        const cost = entitlement.requiredCredits;
        const eventKey = `review:${assignment.id}:reservation`;
        const shouldReserveCredits = entitlement.reason === "credits";

        if (shouldReserveCredits) {
          await tx.$executeRawUnsafe(
            `
            insert into "TruvernCreditLedgerEntry" (
              "organizationId",
              "reviewAssignmentId",
              "reviewRequestId",
              "vendorId",
              "entryType",
              "fundingSource",
              status,
              "availableDelta",
              "reservedDelta",
              "consumedDelta",
              quantity,
              note,
              "metadataJson",
              "createdAt",
              "updatedAt"
            )
            select
              $1,
              $2,
              $3,
              $4,
              'RESERVATION',
              'PREPAID_CREDITS',
              'POSTED',
              $5,
              $6,
              0,
              $7,
              $8,
              $9::jsonb,
              now(),
              now()
            where not exists (
              select 1
              from "TruvernCreditLedgerEntry"
              where "reviewAssignmentId" = $2
                and "entryType" = 'RESERVATION'
                and status = 'POSTED'
            )
            `,
            vendor.organizationId,
            assignment.id,
            request.id,
            vendor.id,
            -cost,
            cost,
            cost,
            `Reserved ${cost} Truvern credit${cost === 1 ? "" : "s"} for expert review.`,
            JSON.stringify({
              source: "review_desk_assignment",
              vendorId: vendor.id,
              vendorName: vendor.name,
              requestId: request.id,
              assignmentId: assignment.id,
              creditCost: cost,
              entitlementReason: entitlement.reason,
              legalAcknowledgement,
            }),
          );
        }

        reservation = {
          eventKey: shouldReserveCredits ? eventKey : null,
          reservedCredits: shouldReserveCredits ? cost : 0,
          entitlementReason: entitlement.reason,
          eligiblePlan: entitlement.eligiblePlan,
        };
      }


      // AUTO_LAUNCH_TRUVERN_VENDOR_QUESTIONNAIRE
      // Truvern Review requests immediately create a vendor questionnaire token.
      if (mode === "truvern") {
        const existingAssessmentRows = await tx.$queryRaw<Array<{ id: number }>>`
          select id
          from "Assessment"
          where "reviewAssignmentId" = ${assignment.id}
          limit 1
        `;

        if (!existingAssessmentRows[0]) {
          const templates = await tx.$queryRaw<Array<{ id: number; name: string; questionCount: number }>>`
            select
              t.id,
              t.name,
              count(q.id)::int as "questionCount"
            from "AssessmentTemplate" t
            left join "AssessmentQuestion" q on q."templateId" = t.id
            where t.name = 'Truvern NIST 800-53 Governance Review'
            group by t.id, t.name
            having count(q.id) = 120
            limit 1
          `;

          const template = templates[0] ?? null;

          if (!template) {
            throw new Error("Required template missing: Truvern NIST 800-53 Governance Review with exactly 120 questions.");
          }

          const token = buildVendorAssessmentToken();

          await tx.$executeRaw`
            insert into "Assessment" (
              "organizationId",
              "vendorId",
              "templateId",
              "reviewAssignmentId",
              title,
              status,
              token,
              "vendorEmail",
              "vendorContactName",
              "launchedAt",
              "dueAt",
              "isVendorSubmitted",
              "createdAt",
              "updatedAt"
            )
            values (
              ${vendor.organizationId},
              ${vendor.id},
              ${template?.id ?? null},
              ${assignment.id},
              ${`${template?.name ?? "Truvern Review Questionnaire"} for ${vendor.name}`},
              'LAUNCHED'::"AssessmentStatus",
              ${token},
              ${null},
              ${null},
              now(),
              ${addDays(14)},
              false,
              now(),
              now()
            )
          `;

          await tx.$executeRaw`
            update "ReviewAssignment"
            set "reviewerName" = 'Truvern Review Team',
                "assignedReviewerName" = 'Truvern Review Team',
                "assignedTo" = 'Truvern Review Team',
                "startedAt" = coalesce("startedAt", now())
            where id = ${assignment.id}
          `;
        }
      }
      return {
        status: 200,
        body: {
          ok: true,
          requestId: request.id,
          assignmentId: assignment.id,
          mode,
          reservation,
          legalAcknowledgement,
          redirectUrl: `/vendors/${vendor.id}?managedReview=created&assignmentId=${assignment.id}#reviews`,
        },
      };
    });

    return json(result.status, result.body);
  } catch (error) {
    console.error(
      "TRUVERN_ASSIGNMENT_CREATE_ERROR",
      error
    );

    return json(500, {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to create review assignment",
      detail:
        error instanceof Error
          ? error.stack
          : null,
    });
  }
}






























