import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { isTruvernOperator } from "@/lib/truvern-ops-access";
import { readTruvernReviewTemplateSelection } from "@/lib/repositories/truvern-review-template-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function safeInt(value: unknown): number | null {
  const parsed =
    Number(
      String(value ?? "").trim(),
    );

  return Number.isInteger(parsed) &&
    parsed > 0
    ? parsed
    : null;
}

function configuredReviewCreditCost(): number {
  return (
    safeInt(
      process.env.TRUVERN_REVIEW_CREDIT_COST,
    ) ?? 1
  );
}

function normalizeEmail(
  value: string | null | undefined,
): string | null {
  const normalized =
    String(value ?? "")
      .trim()
      .toLowerCase();

  return normalized || null;
}

function maskEmail(
  value: string | null | undefined,
): string | null {
  const normalized =
    normalizeEmail(value);

  if (!normalized) {
    return null;
  }

  const at =
    normalized.indexOf("@");

  if (at <= 0) {
    return "***";
  }

  const local =
    normalized.slice(0, at);

  const domain =
    normalized.slice(at + 1);

  const maskedLocal =
    local.length <= 1
      ? "*"
      : `${local[0]}***`;

  return `${maskedLocal}@${domain}`;
}

function defaultDeliveryRecipients(input: {
  assessmentVendorEmail:
    | string
    | null
    | undefined;
  vendorContactEmail:
    | string
    | null
    | undefined;
}): string[] {
  return Array.from(
    new Set(
      [
        normalizeEmail(
          input.assessmentVendorEmail,
        ),
        normalizeEmail(
          input.vendorContactEmail,
        ),
      ].filter(
        (value): value is string =>
          Boolean(value),
      ),
    ),
  );
}

function json(
  status: number,
  body: Record<string, unknown>,
) {
  return NextResponse.json(
    body,
    {
      status,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

export async function GET(
  request: NextRequest,
) {
  const authorized =
    await isTruvernOperator();

  if (!authorized) {
    return json(
      403,
      {
        error: "Not authorized.",
      },
    );
  }

  const url =
    new URL(request.url);

  const organizationId =
    safeInt(
      url.searchParams.get(
        "organizationId",
      ),
    );

  const vendorId =
    safeInt(
      url.searchParams.get(
        "vendorId",
      ),
    );

  const templateId =
    safeInt(
      url.searchParams.get(
        "templateId",
      ),
    );

  const assessmentId =
    safeInt(
      url.searchParams.get(
        "assessmentId",
      ),
    );

  if (
    !organizationId ||
    !vendorId ||
    !templateId
  ) {
    return json(
      400,
      {
        error:
          "Valid organizationId, vendorId, and templateId are required.",
      },
    );
  }

  const organization =
    await prisma.organization.findFirst({
      where: {
        id: organizationId,
      },
      select: {
        id: true,
        name: true,
        planTier: true,
      },
    });

  if (!organization) {
    return json(
      404,
      {
        error: "Organization not found.",
      },
    );
  }

  const vendor =
    await prisma.vendor.findFirst({
      where: {
        id: vendorId,
        organizationId,
        deletedAt: null,
      },
      select: {
        id: true,
        organizationId: true,
        name: true,
        contactEmail: true,
        contactName: true,
        contacts: {
          orderBy: [
            {
              isPrimary: "desc",
            },
            {
              id: "asc",
            },
          ],
          select: {
            id: true,
            isPrimary: true,
            email: true,
          },
        },
      },
    });

  if (!vendor) {
    return json(
      404,
      {
        error:
          "Vendor not found in organization.",
      },
    );
  }

  const template =
    await readTruvernReviewTemplateSelection(
      {
        templateId,
        organizationId,
      },
    );

  const matchingAssessments =
    await prisma.assessment.findMany({
      where: {
        organizationId,
        vendorId,
        templateId,
      },
      orderBy: [
        {
          createdAt: "desc",
        },
        {
          id: "desc",
        },
      ],
      select: {
        id: true,
        status: true,
        vendorEmail: true,
        token: true,
        reviewAssignmentId: true,
        launchedAt: true,
        openedAt: true,
        reviewReadyAt: true,
        startedAt: true,
        submittedAt: true,
        completedAt: true,
        archivedAt: true,
        completionPercent: true,
        isVendorSubmitted: true,
        createdAt: true,
        updatedAt: true,
      },
    });

  const launchReuseSearchCandidate =
    matchingAssessments
      .filter(
        (candidate) =>
          candidate.isVendorSubmitted === false &&
          (
            candidate.status === "LAUNCHED" ||
            candidate.status === "IN_PROGRESS" ||
            candidate.status === "DRAFT"
          ),
      )
      .sort(
        (left, right) =>
          right.id - left.id,
      )[0] ?? null;

  const launchReuseCandidate =
    launchReuseSearchCandidate?.token
      ? launchReuseSearchCandidate
      : null;
  const assessment =
    assessmentId
      ? matchingAssessments.find(
          (row) =>
            row.id === assessmentId,
        ) ?? null
      : null;

  if (
    assessmentId &&
    !assessment
  ) {
    return json(
      404,
      {
        error:
          "Assessment does not match organization, vendor, and template.",
      },
    );
  }

  const reviewRequests =
    await prisma.reviewRequest.findMany({
      where: {
        organizationId,
        vendorId,
      },
      orderBy: [
        {
          createdAt: "asc",
        },
        {
          id: "asc",
        },
      ],
      select: {
        id: true,
        organizationId: true,
        vendorId: true,
        assessmentId: true,
        status: true,
        kind: true,
        createdAt: true,
        updatedAt: true,
        reviewAssignments: {
          orderBy: {
            id: "asc",
          },
          select: {
            id: true,
            organizationId: true,
            vendorId: true,
            reviewRequestId: true,
            assignmentType: true,
            status: true,
            reviewerUserId: true,
            startedAt: true,
            claimedAt: true,
            submittedAt: true,
            completedAt: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });

  const assignments =
    reviewRequests.flatMap(
      (row) =>
        row.reviewAssignments,
    );

  const activeAssignments =
    assignments.filter(
      (assignment) => {
        const status =
          String(
            assignment.status ?? "",
          )
            .trim()
            .toUpperCase();

        return (
          status === "PENDING" ||
          status === "IN_PROGRESS"
        );
      },
    );

  const creditAggregate =
    await prisma.truvernCreditLedgerEntry.aggregate({
      where: {
        organizationId,
        status: "POSTED",
      },
      _sum: {
        availableDelta: true,
        reservedDelta: true,
        consumedDelta: true,
      },
    });

  const creditLedgerEvents =
    await prisma.truvernCreditLedgerEntry.findMany({
      where: {
        organizationId,
        vendorId,
        status: "POSTED",
      },
      select: {
        id: true,
        entryType: true,
        availableDelta: true,
        reservedDelta: true,
        consumedDelta: true,
        status: true,
        quantity: true,
        reviewAssignmentId: true,
        reviewRequestId: true,
        vendorId: true,
        eventKey: true,
        createdAt: true,
      },
      orderBy: {
        id: "asc",
      },
    });
  const availableCredits =
    Number(
      creditAggregate
        ._sum
        .availableDelta ?? 0,
    );

  const reservedCredits =
    Number(
      creditAggregate
        ._sum
        .reservedDelta ?? 0,
    );

  const consumedCredits =
    Number(
      creditAggregate
        ._sum
        .consumedDelta ?? 0,
    );

  const effectiveCreditCost =
    configuredReviewCreditCost();

  const deliveryRecipients =
    defaultDeliveryRecipients({
      assessmentVendorEmail:
        assessment?.vendorEmail,
      vendorContactEmail:
        vendor.contactEmail,
    });

  const externalThreadId =
    assessment
      ? `assessment:${assessment.id}:vendor-link`
      : null;

  const conversations =
    assessment
      ? await prisma.communicationConversation.findMany({
          where: {
            organizationId,
            assessmentId:
              assessment.id,
            externalThreadId,
          },
          orderBy: [
            {
              createdAt: "asc",
            },
            {
              id: "asc",
            },
          ],
          select: {
            id: true,
            organizationId: true,
            vendorId: true,
            assessmentId: true,
            reviewRequestId: true,
            reviewAssignmentId: true,
            status: true,
            channel: true,
            externalThreadId: true,
            createdAt: true,
            lastMessageAt: true,
            communicationMessages: {
              orderBy: [
                {
                  createdAt: "asc",
                },
                {
                  id: "asc",
                },
              ],
              select: {
                id: true,
                direction: true,
                status: true,
                queuedAt: true,
                sentAt: true,
                deliveredAt: true,
                failedAt: true,
                createdAt: true,
              },
            },
          },
        })
      : [];

  const outboundMessages =
    conversations.flatMap(
      (conversation) =>
        conversation
          .communicationMessages
          .filter(
            (message) =>
              String(
                message.direction,
              )
                .trim()
                .toUpperCase() ===
              "OUTBOUND",
          ),
    );

  const autoOnceBlockingMessages =
    outboundMessages.filter(
      (message) => {
        const status =
          String(
            message.status ?? "",
          )
            .trim()
            .toUpperCase();

        return (
          status === "QUEUED" ||
          status === "SENT" ||
          status === "DELIVERED"
        );
      },
    );

  return json(
    200,
    {
      mode:
        assessment
          ? "POST_ASSESSMENT"
          : "PRE_ASSESSMENT",

      identity: {
        organizationId:
          organization.id,
        organizationName:
          organization.name,
        organizationPlanTier:
          organization.planTier,
        vendorId:
          vendor.id,
        vendorName:
          vendor.name,
        templateId,
      },

      template: template
        ? {
            valid: true,
            id: template.id,
            name: template.name,
            source: template.source,
            isSystem:
              template.isSystem,
            questionCount:
              template.questionCount,
          }
        : {
            valid: false,
            id: templateId,
          },

      vendorRecipient: {
        canonicalConfigured:
          Boolean(
            normalizeEmail(
              vendor.contactEmail,
            ),
          ),
        canonicalMaskedEmail:
          maskEmail(
            vendor.contactEmail,
          ),
        contacts:
          vendor.contacts.map(
            (contact) => ({
              id: contact.id,
              isPrimary:
                contact.isPrimary,
              configured:
                Boolean(
                  normalizeEmail(
                    contact.email,
                  ),
                ),
              maskedEmail:
                maskEmail(
                  contact.email,
                ),
            }),
          ),
      },

      assessments: {
        launchReuseCandidate:
          launchReuseCandidate
            ? {
                id:
                  launchReuseCandidate.id,
                status:
                  launchReuseCandidate.status,
                hasToken:
                  Boolean(
                    launchReuseCandidate.token,
                  ),
                isVendorSubmitted:
                  launchReuseCandidate.isVendorSubmitted,
                reviewAssignmentId:
                  launchReuseCandidate.reviewAssignmentId,
              }
            : null,
        matchingCount:
          matchingAssessments.length,
        selectedAssessmentId:
          assessment?.id ?? null,
        rows:
          matchingAssessments.map(
            (row) => ({
              id: row.id,
              status: row.status,
              reviewAssignmentId:
                row.reviewAssignmentId,
              vendorEmailConfigured:
                Boolean(
                  normalizeEmail(
                    row.vendorEmail,
                  ),
                ),
              maskedVendorEmail:
                maskEmail(
                  row.vendorEmail,
                ),
              launchedAt:
                row.launchedAt,
              openedAt:
                row.openedAt,
              reviewReadyAt:
                row.reviewReadyAt,
              startedAt:
                row.startedAt,
              submittedAt:
                row.submittedAt,
              completedAt:
                row.completedAt,
              archivedAt:
                row.archivedAt,
              completionPercent:
                row.completionPercent,
              isVendorSubmitted:
                row.isVendorSubmitted,
              createdAt:
                row.createdAt,
              updatedAt:
                row.updatedAt,
            }),
          ),
      },

      delivery: {
        defaultRecipientCount:
          deliveryRecipients.length,
        defaultRecipientsMasked:
          deliveryRecipients.map(
            (recipient) =>
              maskEmail(recipient),
          ),
        assessmentSnapshotConfigured:
          Boolean(
            normalizeEmail(
              assessment?.vendorEmail,
            ),
          ),
        vendorCanonicalConfigured:
          Boolean(
            normalizeEmail(
              vendor.contactEmail,
            ),
          ),
      },

      lifecycle: {
        reviewRequestCount:
          reviewRequests.length,
        assignmentCount:
          assignments.length,
        activeAssignmentCount:
          activeAssignments.length,
        reviewRequests,
      },

      credits: {
        ledgerEvents:
          creditLedgerEvents.map(
            (entry) => ({
              id: entry.id,
              entryType:
                entry.entryType,
              availableDelta:
                entry.availableDelta,
              reservedDelta:
                entry.reservedDelta,
              consumedDelta:
                entry.consumedDelta,
              status:
                entry.status,
              quantity:
                entry.quantity,
              reviewAssignmentId:
                entry.reviewAssignmentId,
              reviewRequestId:
                entry.reviewRequestId,
              vendorId:
                entry.vendorId,
              eventKey:
                entry.eventKey,
              createdAt:
                entry.createdAt,
            }),
          ),
        effectiveCreditCost,
        exactOneCreditCost:
          effectiveCreditCost === 1,
        availableCredits,
        reservedCredits,
        consumedCredits,
        canReserveEffectiveCost:
          availableCredits >=
          effectiveCreditCost,
      },

      communication: {
        externalThreadId,
        conversationCount:
          conversations.length,
        outboundMessageCount:
          outboundMessages.length,
        autoOnceBlockingMessageCount:
          autoOnceBlockingMessages.length,
        autoOnceWouldSkip:
          autoOnceBlockingMessages.length >
          0,
        conversations,
      },

      canaryPreconditions: {
        templateValid:
          Boolean(template),
        exactOneCreditCost:
          effectiveCreditCost === 1,
        canReserveExactlyOne:
          effectiveCreditCost === 1 &&
          availableCredits >= 1,
        noActiveAssignment:
          activeAssignments.length === 0,
        noMatchingAssessment:
          matchingAssessments.length === 0,
        vendorCanonicalRecipientConfigured:
          Boolean(
            normalizeEmail(
              vendor.contactEmail,
            ),
          ),
        selectedAssessmentRecipientConfigured:
          deliveryRecipients.length > 0,
        autoOnceClear:
          autoOnceBlockingMessages.length ===
          0,
      },

      safety: {
        readOnly: true,
        rawEmailReturned: false,
        vendorPortalOpened: false,
      },
    },
  );
}
