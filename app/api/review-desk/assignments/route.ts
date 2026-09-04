import { randomBytes, randomUUID } from "node:crypto";
import { sendAssessmentVendorLink } from "@/lib/communications/assessment-vendor-link";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  canLaunchGovernanceTemplate,
  governanceTemplateGateMessage,
} from "@/lib/governance/template-access";
import { getCurrentOrgPlanTier } from "@/lib/billing/plan-access";
import { createNotification } from "@/lib/notifications/create-notification";
import { findFirstReviewAssignment } from "@/lib/repositories/review-assignment-repository";
import { aggregateTruvernCreditLedger, createTruvernCreditLedgerEntry, findFirstTruvernCreditLedgerEntry } from "@/lib/repositories/review-credit-ledger-repository";
import { acquireReviewAssignmentAdvisoryLock } from "@/lib/repositories/review-assignment-lock-repository";
import { readTruvernReviewTemplateSelection } from "@/lib/repositories/truvern-review-template-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const TRUVERN_REVIEW_TEMPLATE_NAME =
  "Truvern NIST 800-53 Governance Review";

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
  const balanceAggregate =
    await aggregateTruvernCreditLedger({
      where: {
        organizationId,
        status: "POSTED",
      },
      _sum: {
        availableDelta: true,
        reservedDelta: true,
        consumedDelta: true,
      },
    }, tx);

  const availableCredits =
    balanceAggregate._sum.availableDelta ?? 0;

  const reservedCredits =
    balanceAggregate._sum.reservedDelta ?? 0;

  const consumedCredits =
    balanceAggregate._sum.consumedDelta ?? 0;

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
    const templateId = safeInt(body?.templateId);
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
          "Customer acknowledgement acceptance is required for Truvern Reviews.",
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

      await acquireReviewAssignmentAdvisoryLock(tx, {
        organizationId: vendor.organizationId,
        vendorId: vendor.id,
      });
      let selectedTemplate:
        | {
            id: number;
            name: string;
            questionCount: number;
          }
        | null = null;

      if (mode === "truvern") {
        if (!templateId) {
          return {
            status: 400,
            body: {
              ok: false,
              code: "TRUVERN_REVIEW_TEMPLATE_REQUIRED",
              error:
                "Select an assessment template before requesting Truvern Review.",
            },
          };
        }

        selectedTemplate =
          await readTruvernReviewTemplateSelection(
            {
              templateId,
              organizationId: vendor.organizationId,
            },
            tx,
          );

        if (!selectedTemplate) {
          return {
            status: 400,
            body: {
              ok: false,
              code: "INVALID_TRUVERN_REVIEW_TEMPLATE",
              error:
                "The selected assessment template is unavailable or does not belong to your organization.",
            },
          };
        }

        if (
          selectedTemplate.name !==
          TRUVERN_REVIEW_TEMPLATE_NAME
        ) {
          return {
            status: 400,
            body: {
              ok: false,
              code: "TRUVERN_REVIEW_TEMPLATE_REQUIRED",
              error:
                "Truvern Review uses the Truvern NIST 800-53 Governance Review questionnaire.",
            },
          };
        }

        if (selectedTemplate.questionCount < 1) {
          return {
            status: 400,
            body: {
              ok: false,
              code: "EMPTY_TRUVERN_REVIEW_TEMPLATE",
              error:
                "The selected assessment template contains no questions.",
            },
          };
        }
      }

      if (mode === "internal") {
        const activeInternalAssignment =
          await findFirstReviewAssignment({
            where: {
              status: {
                in: ["PENDING", "IN_PROGRESS"],
              },
              assignmentType: "INTERNAL",
              reviewRequest: {
                is: {
                  vendorId: vendor.id,
                  organizationId: vendor.organizationId,
                  assessmentId,
                },
              },
            },
            select: {
              id: true,
              status: true,
              reviewRequestId: true,
            },
            orderBy: [
              { updatedAt: "desc" },
              { id: "desc" },
            ],
          }, tx);

        if (
          activeInternalAssignment?.id &&
          activeInternalAssignment.reviewRequestId
        ) {
          const internalAssessmentRows =
            await tx.$queryRaw<
              Array<{
                id: number;
                reviewAssignmentId: number | null;
              }>
            >`
              select
                id,
                "reviewAssignmentId"
              from "Assessment"
              where id = ${assessmentId}
                and "organizationId" = ${vendor.organizationId}
                and "vendorId" = ${vendor.id}
              limit 1
            `;

          const internalExistingAssessment =
            internalAssessmentRows[0] ?? null;

          if (!internalExistingAssessment) {
            throw new Error(
              "The selected assessment could not be resolved for this vendor.",
            );
          }

          if (
            internalExistingAssessment.reviewAssignmentId &&
            internalExistingAssessment.reviewAssignmentId !==
              activeInternalAssignment.id
          ) {
            throw new Error(
              "The selected assessment is already linked to another review assignment.",
            );
          }

          if (!internalExistingAssessment.reviewAssignmentId) {
            await tx.$executeRaw`
              update "Assessment"
              set
                "reviewAssignmentId" = ${activeInternalAssignment.id},
                "updatedAt" = now()
              where id = ${assessmentId}
                and "organizationId" = ${vendor.organizationId}
                and "vendorId" = ${vendor.id}
            `;
          }

          return {
            status: 200,
            body: {
              ok: true,
              alreadyExists: true,
              requestId:
                activeInternalAssignment.reviewRequestId,
              assignmentId:
                activeInternalAssignment.id,
              mode,
              redirectUrl:
                `/review-desk/${activeInternalAssignment.id}`,
            },
          };
        }
      }

      let entitlement: TruvernEntitlement | null = null;
      if (mode === "truvern") {
        const activeAssignment =
          await findFirstReviewAssignment({
            where: {
              status: {
                in: ["PENDING", "IN_PROGRESS"],
              },
              reviewRequest: {
                is: {
                  vendorId: vendor.id,
                  organizationId: vendor.organizationId,
                  assessmentId,
                },
              },
              OR: [
                {
                  note: {
                    contains: "truvern",
                    mode: "insensitive",
                  },
                },
                {
                  reviewRequest: {
                    is: {
                      title: {
                        contains: "truvern",
                        mode: "insensitive",
                      },
                    },
                  },
                },
                {
                  reviewRequest: {
                    is: {
                      note: {
                        contains: "truvern",
                        mode: "insensitive",
                      },
                    },
                  },
                },
              ],
            },
            select: {
              id: true,
              status: true,
              reviewRequestId: true,
            },
            orderBy: [
              { updatedAt: "desc" },
              { id: "desc" },
            ],
          }, tx);

        const active =
          activeAssignment?.reviewRequestId
            ? {
                assignmentId: activeAssignment.id,
                requestId: activeAssignment.reviewRequestId,
                status: activeAssignment.status,
              }
            : null;

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
          ? `Truvern Review - ${vendor.name}`
          : `Self-Managed Review - ${vendor.name}`;

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
      // INTERNAL_ASSESSMENT_ASSIGNMENT_LINKAGE
      // A newly created Self-Managed Review owns its submitted
      // assessment immediately. Truvern Review retains its
      // questionnaire-specific linkage path below.
      if (mode === "internal") {
        const internalAssessmentRows =
          await tx.$queryRaw<
            Array<{
              id: number;
              reviewAssignmentId: number | null;
            }>
          >`
            select
              id,
              "reviewAssignmentId"
            from "Assessment"
            where id = ${assessmentId}
              and "organizationId" = ${vendor.organizationId}
              and "vendorId" = ${vendor.id}
            limit 1
          `;

        const internalAssessment =
          internalAssessmentRows[0] ?? null;

        if (!internalAssessment) {
          throw new Error(
            "The selected assessment could not be resolved for this vendor.",
          );
        }

        if (
          internalAssessment.reviewAssignmentId &&
          internalAssessment.reviewAssignmentId !== assignment.id
        ) {
          throw new Error(
            "The selected assessment is already linked to another review assignment.",
          );
        }

        if (!internalAssessment.reviewAssignmentId) {
          await tx.$executeRaw`
            update "Assessment"
            set
              "reviewAssignmentId" = ${assignment.id},
              "updatedAt" = now()
            where id = ${assessmentId}
              and "organizationId" = ${vendor.organizationId}
              and "vendorId" = ${vendor.id}
          `;
        }
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
            title: `New Truvern Review - ${vendor.name}`,
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
          }, tx);
        }

        if (opsUsers.length === 0) {
          await createNotification({
            userId: null,
            organizationId: null,
            type: "REVIEW_ASSIGNED",
            severity: "INFO",
            title: `New Truvern Review - ${vendor.name}`,
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
          }, tx);
        }
      }

      if (mode === "truvern" && entitlement) {
        const cost = entitlement.requiredCredits;
        const eventKey = `review:${assignment.id}:reservation`;
        const shouldReserveCredits = entitlement.reason === "credits";

        if (shouldReserveCredits) {
          const existingReservation =
            await findFirstTruvernCreditLedgerEntry({
              where: {
                reviewAssignmentId: assignment.id,
                entryType: "RESERVATION",
                status: "POSTED",
              },
              select: {
                id: true,
              },
            }, tx);

          if (!existingReservation) {
            await createTruvernCreditLedgerEntry({
              data: {
                organizationId: vendor.organizationId,
                reviewAssignmentId: assignment.id,
                reviewRequestId: request.id,
                vendorId: vendor.id,
                entryType: "RESERVATION",
                fundingSource: "PREPAID_CREDITS",
                status: "POSTED",
                availableDelta: -cost,
                reservedDelta: cost,
                consumedDelta: 0,
                quantity: cost,
                note: `Reserved ${cost} Truvern credit${cost === 1 ? "" : "s"} for expert review.`,
                eventKey,
                metadataJson: {
                  source: "review_desk_assignment",
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
              },
            }, tx);
          }
        }

        reservation = {
          eventKey: shouldReserveCredits ? eventKey : null,
          reservedCredits: shouldReserveCredits ? cost : 0,
          entitlementReason: entitlement.reason,
          eligiblePlan: entitlement.eligiblePlan,
        };
      }


      let resolvedAssessmentId =
        assessmentId ?? null;

      // AUTO_LAUNCH_TRUVERN_VENDOR_QUESTIONNAIRE
      // Truvern Review requests immediately create a vendor questionnaire token.
      if (mode === "truvern") {
        const template = selectedTemplate;

        if (!template) {
          throw new Error(
            "Selected Truvern Review template was not resolved.",
          );
        }

        if (assessmentId) {
          const assessmentRows = await tx.$queryRaw<
            Array<{
              id: number;
              templateId: number | null;
              reviewAssignmentId: number | null;
            }>
          >`
            select
              id,
              "templateId",
              "reviewAssignmentId"
            from "Assessment"
            where id = ${assessmentId}
              and "organizationId" = ${vendor.organizationId}
              and "vendorId" = ${vendor.id}
            limit 1
          `;

          const existingAssessment =
            assessmentRows[0] ?? null;

          if (!existingAssessment) {
            throw new Error(
              "The selected assessment could not be resolved for this vendor.",
            );
          }

          if (
            existingAssessment.templateId !== template.id
          ) {
            throw new Error(
              "The selected assessment does not use the selected Truvern Review template.",
            );
          }

          if (
            existingAssessment.reviewAssignmentId &&
            existingAssessment.reviewAssignmentId !== assignment.id
          ) {
            throw new Error(
              "The selected assessment is already linked to another review assignment.",
            );
          }

          if (!existingAssessment.reviewAssignmentId) {
            await tx.$executeRaw`
              update "Assessment"
              set
                "reviewAssignmentId" = ${assignment.id},
                "updatedAt" = now()
              where id = ${assessmentId}
                and "organizationId" = ${vendor.organizationId}
                and "vendorId" = ${vendor.id}
            `;
          }
        } else {
          const existingAssessmentRows = await tx.$queryRaw<
            Array<{ id: number }>
          >`
            select id
            from "Assessment"
            where "reviewAssignmentId" = ${assignment.id}
            limit 1
          `;

          if (existingAssessmentRows[0]?.id) {
            resolvedAssessmentId =
              existingAssessmentRows[0].id;
          } else {
            const token =
              randomBytes(24).toString("hex");

            const createdAssessmentRows =
              await tx.$queryRaw<Array<{ id: number }>>`
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
                  ${template.id},
                  ${assignment.id},
                  ${`${template.name ?? "Truvern Review Questionnaire"} for ${vendor.name}`},
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
                returning id
              `;

            const createdAssessment =
              createdAssessmentRows[0];

            if (!createdAssessment?.id) {
              throw new Error(
                "Failed to create the Truvern Review questionnaire.",
              );
            }

            resolvedAssessmentId =
              createdAssessment.id;

            const linkedRequestCount =
              await tx.$executeRaw`
                update "ReviewRequest"
                set
                  "assessmentId" = ${createdAssessment.id},
                  "updatedAt" = now()
                where id = ${request.id}
                  and "organizationId" = ${vendor.organizationId}
                  and "vendorId" = ${vendor.id}
                  and "assessmentId" is null
              `;

            if (linkedRequestCount !== 1) {
              throw new Error(
                "Failed to link the Truvern Review questionnaire to its review request.",
              );
            }
          }
        }

          await tx.$executeRaw`
            update "ReviewAssignment"
            set "reviewerName" = 'Truvern Review Team',
                "assignedReviewerName" = 'Truvern Review Team',
                "assignedTo" = 'Truvern Review Team',
                "startedAt" = coalesce("startedAt", now())
            where id = ${assignment.id}
          `;
        }
      return {
        status: 200,
        body: {
          ok: true,
          requestId: request.id,
          assignmentId: assignment.id,
          assessmentId:
            resolvedAssessmentId,
          mode,
          reservation,
          legalAcknowledgement,
          redirectUrl: `/vendors/${vendor.id}?managedReview=created&assignmentId=${assignment.id}#reviews`,
        },
      };
    });

    if (
      result.status === 200 &&
      result.body.mode === "truvern"
    ) {
      try {
        const deliveryAssessmentId =
          result.body.assessmentId;

        if (
          !Number.isInteger(deliveryAssessmentId) ||
          Number(deliveryAssessmentId) <= 0
        ) {
          console.error(
            "TRUVERN_ASSIGNMENT_VENDOR_DELIVERY_ERROR",
            {
              assignmentId:
                result.body.assignmentId,
              error:
                "Truvern Review committed without an exact assessment identity for vendor delivery.",
            },
          );

          return json(result.status, {
            ...result.body,
            vendorDelivery: {
              sent: false,
              alreadySent: false,
              error:
                "Vendor delivery could not be completed automatically.",
            },
          });
        }

        const vendorDelivery =
          await sendAssessmentVendorLink({
            assessmentId:
              Number(deliveryAssessmentId),
            mode:
              "AUTO_ONCE",
          });

        return json(result.status, {
          ...result.body,
          vendorDelivery: {
            sent:
              vendorDelivery.sent,
            alreadySent:
              vendorDelivery.alreadySent,
            failed: false,
            error: null,
          },
        });
      } catch (deliveryError) {
        console.error(
          "TRUVERN_ASSIGNMENT_VENDOR_DELIVERY_ERROR",
          {
            assignmentId:
              result.body.assignmentId,
            error:
              deliveryError instanceof Error
                ? deliveryError.message
                : String(deliveryError),
          },
        );

        return json(result.status, {
          ...result.body,
          vendorDelivery: {
            sent: false,
            alreadySent: false,
            failed: true,
            error:
              "Truvern Review was created, but the vendor invitation could not be delivered automatically.",
          },
        });
      }
    }

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
