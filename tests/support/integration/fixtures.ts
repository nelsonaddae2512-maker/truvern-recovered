import type {
  Organization,
  ReviewAssignment,
  ReviewRequest,
  ReviewResponse,
  Vendor,
  VendorCriticality,
  VendorTier,
} from "@prisma/client";
import { randomUUID } from "node:crypto";
import { getIntegrationPrisma } from "./database";

export type IntegrationFixtureRegistry = {
  organizationIds: number[];
  vendorIds: number[];
  reviewRequestIds: number[];
  reviewAssignmentIds: number[];
  reviewResponseIds: number[];
};

export type OrganizationFixtureOptions = {
  name?: string;
  slug?: string;
  planTier?: string;
  clerkOrgId?: string | null;
};

export type VendorFixtureOptions = {
  organizationId: number;
  name?: string;
  slug?: string;
  category?: string | null;
  tier?: VendorTier | null;
  criticality?: VendorCriticality | null;
  riskScore?: number | null;
  status?: string | null;
  summary?: string | null;
  contactName?: string | null;
  contactEmail?: string | null;
};

export type ReviewRequestFixtureOptions = {
  organizationId?: number | null;
  vendorId?: number | null;
  kind?: string | null;
  title?: string | null;
  status?: string | null;
  dueAt?: Date | null;
  assessmentId?: number | null;
  note?: string | null;
};

export type ReviewAssignmentFixtureOptions = {
  organizationId: number;
  vendorId: number;
  reviewRequestId?: number | null;
  assignmentType?: string;
  status?: string;
  reviewerUserId?: string | null;
  assignedReviewerName?: string | null;
  reviewerName?: string | null;
  assignedTo?: string | null;
  note?: string | null;
  createdBy?: string | null;
  startedAt?: Date | null;
  claimedAt?: Date | null;
  submittedAt?: Date | null;
  completedAt?: Date | null;
};

export type ReviewResponseFixtureOptions = {
  reviewAssignmentId?: number | null;
  organizationId?: number | null;
  reviewRequestId?: number | null;
  responses?: unknown;
  draftSavedAt?: Date | null;
  submittedAt?: Date | null;
};

const registry: IntegrationFixtureRegistry = {
  organizationIds: [],
  vendorIds: [],
  reviewRequestIds: [],
  reviewAssignmentIds: [],
  reviewResponseIds: [],
};

function createUniqueSuffix(): string {
  return randomUUID()
    .replaceAll("-", "")
    .slice(0, 16)
    .toLowerCase();
}

function registerId(
  collection: number[],
  id: number,
): void {
  if (!collection.includes(id)) {
    collection.push(id);
  }
}

export function getIntegrationFixtureRegistry():
  Readonly<IntegrationFixtureRegistry> {
  return registry;
}

export function snapshotIntegrationFixtureRegistry():
  IntegrationFixtureRegistry {
  return {
    organizationIds: [...registry.organizationIds],
    vendorIds: [...registry.vendorIds],
    reviewRequestIds: [...registry.reviewRequestIds],
    reviewAssignmentIds: [
      ...registry.reviewAssignmentIds,
    ],
    reviewResponseIds: [...registry.reviewResponseIds],
  };
}

export function resetIntegrationFixtureRegistry():
  void {
  registry.organizationIds.length = 0;
  registry.vendorIds.length = 0;
  registry.reviewRequestIds.length = 0;
  registry.reviewAssignmentIds.length = 0;
  registry.reviewResponseIds.length = 0;
}

export async function createOrganizationFixture(
  options: OrganizationFixtureOptions = {},
): Promise<Organization> {
  const prisma = getIntegrationPrisma();
  const suffix = createUniqueSuffix();

  const organization =
    await prisma.organization.create({
      data: {
        name:
          options.name ??
          `Truvern Integration Organization ${suffix}`,
        slug:
          options.slug ??
          `truvern-integration-org-${suffix}`,
        planTier: options.planTier ?? "FREE",
        clerkOrgId: options.clerkOrgId ?? null,
      },
    });

  registerId(
    registry.organizationIds,
    organization.id,
  );

  return organization;
}

export async function createVendorFixture(
  options: VendorFixtureOptions,
): Promise<Vendor> {
  const prisma = getIntegrationPrisma();
  const suffix = createUniqueSuffix();

  const vendor = await prisma.vendor.create({
    data: {
      organizationId: options.organizationId,
      name:
        options.name ??
        `Truvern Integration Vendor ${suffix}`,
      slug:
        options.slug ??
        `truvern-integration-vendor-${suffix}`,
      category: options.category ?? "SaaS",
      tier: options.tier ?? null,
      criticality: options.criticality ?? null,
      riskScore: options.riskScore ?? null,
      status: options.status ?? "INTAKE",
      summary:
        options.summary ??
        "Database-backed integration test vendor.",
      contactName: options.contactName ?? null,
      contactEmail: options.contactEmail ?? null,
    },
  });

  registerId(
    registry.vendorIds,
    vendor.id,
  );

  return vendor;
}

export async function createReviewRequestFixture(
  options: ReviewRequestFixtureOptions = {},
): Promise<ReviewRequest> {
  const prisma = getIntegrationPrisma();
  const suffix = createUniqueSuffix();

  const reviewRequest =
    await prisma.reviewRequest.create({
      data: {
        organizationId:
          options.organizationId ?? null,
        vendorId: options.vendorId ?? null,
        kind: options.kind ?? "TRUVERN_REVIEW",
        title:
          options.title ??
          `Integration Review Request ${suffix}`,
        status: options.status ?? "REQUESTED",
        dueAt: options.dueAt ?? null,
        assessmentId:
          options.assessmentId ?? null,
        note:
          options.note ??
          "Created by the Truvern integration fixture registry.",
      },
    });

  registerId(
    registry.reviewRequestIds,
    reviewRequest.id,
  );

  return reviewRequest;
}

export async function createReviewAssignmentFixture(
  options: ReviewAssignmentFixtureOptions,
): Promise<ReviewAssignment> {
  const prisma = getIntegrationPrisma();

  const assignment =
    await prisma.reviewAssignment.create({
      data: {
        organizationId: options.organizationId,
        vendorId: options.vendorId,
        reviewRequestId:
          options.reviewRequestId ?? null,
        assignmentType:
          options.assignmentType ??
          "TRUVERN_REVIEW",
        status: options.status ?? "PENDING",
        reviewerUserId:
          options.reviewerUserId ?? null,
        assignedReviewerName:
          options.assignedReviewerName ?? null,
        reviewerName:
          options.reviewerName ?? null,
        assignedTo:
          options.assignedTo ?? null,
        note:
          options.note ??
          "Created by the Truvern integration fixture registry.",
        createdBy:
          options.createdBy ??
          "integration-test",
        startedAt: options.startedAt ?? null,
        claimedAt: options.claimedAt ?? null,
        submittedAt: options.submittedAt ?? null,
        completedAt: options.completedAt ?? null,
      },
    });

  registerId(
    registry.reviewAssignmentIds,
    assignment.id,
  );

  return assignment;
}

export async function createReviewResponseFixture(
  options: ReviewResponseFixtureOptions = {},
): Promise<ReviewResponse> {
  const prisma = getIntegrationPrisma();

  const response =
    await prisma.reviewResponse.create({
      data: {
        reviewAssignmentId:
          options.reviewAssignmentId ?? null,
        organizationId:
          options.organizationId ?? null,
        reviewRequestId:
          options.reviewRequestId ?? null,
        responses:
          options.responses === undefined
            ? {}
            : JSON.parse(
                JSON.stringify(options.responses),
              ),
        draftSavedAt:
          options.draftSavedAt ?? null,
        submittedAt:
          options.submittedAt ?? null,
      },
    });

  registerId(
    registry.reviewResponseIds,
    response.id,
  );

  return response;
}