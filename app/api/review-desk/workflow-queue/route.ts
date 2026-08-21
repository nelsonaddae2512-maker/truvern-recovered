import { NextResponse } from "next/server";
import { requireReviewerAccess } from "@/lib/auth/truvern-governance";
import prisma from "@/lib/prisma";
import { findWorkflowQueueItems, groupWorkflowQueueItems } from "@/lib/repositories/workflow-queue-repository";
import { findVendors } from "@/lib/repositories/vendor-repository";
import { findRemediationPackages } from "@/lib/repositories/remediation-package-repository";
import { findOrganizations } from "@/lib/repositories/organization-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    await requireReviewerAccess();

    const grouped =
      await groupWorkflowQueueItems();

    const summary = grouped.map((row) => ({
      queue: row.queue,
      status: row.status,
      count: row._count._all,
      lastUpdatedAt: row._max.updatedAt,
    }));

    const queueItems = await findWorkflowQueueItems({
      where: {
        status: "OPEN",
      },
      select: {
        id: true,
        queue: true,
        status: true,
        priority: true,
        dueAt: true,
        updatedAt: true,
        payload: true,
        workflowId: true,
        vendorId: true,
        organizationId: true,
        reviewAssignmentId: true,
        WorkflowInstance: {
          select: {
            id: true,
            currentStage: true,
            type: true,
          },
        },
      },
      orderBy: [
        { priority: "desc" },
        {
          dueAt: {
            sort: "asc",
            nulls: "last",
          },
        },
        { updatedAt: "asc" },
      ],
      take: 100,
    });

    const vendorIds = Array.from(
      new Set(
        queueItems
          .map((item) => item.vendorId)
          .filter((id): id is number => typeof id === "number"),
      ),
    );

    const organizationIds = Array.from(
      new Set(queueItems.map((item) => item.organizationId)),
    );

    const packageIds = Array.from(
      new Set(
        queueItems
          .map((item) => {
            if (
              !item.payload ||
              typeof item.payload !== "object" ||
              Array.isArray(item.payload)
            ) {
              return null;
            }

            const value = (
              item.payload as Record<string, any>
            ).remediationPackageId;

            const parsed = Number(value);

            return Number.isFinite(parsed) && parsed > 0
              ? parsed
              : null;
          })
          .filter((id): id is number => typeof id === "number"),
      ),
    );

    const [vendors, organizations, packages] = await Promise.all([
      vendorIds.length
        ? findVendors({
            where: {
              id: {
                in: vendorIds,
              },
            },
            select: {
              id: true,
              name: true,
            },
          })
        : Promise.resolve([]),

      organizationIds.length
        ? findOrganizations({
            where: {
              id: {
                in: organizationIds,
              },
            },
            select: {
              id: true,
              name: true,
            },
          })
        : Promise.resolve([]),

      packageIds.length
        ? findRemediationPackages({
            where: {
              id: {
                in: packageIds,
              },
            },
            select: {
              id: true,
              title: true,
              status: true,
              severity: true,
            },
          })
        : Promise.resolve([]),
    ]);

    const vendorById = new Map(
      vendors.map((vendor) => [vendor.id, vendor]),
    );

    const organizationById = new Map(
      organizations.map((organization) => [
        organization.id,
        organization,
      ]),
    );

    const packageById = new Map(
      packages.map((pkg) => [pkg.id, pkg]),
    );

    const items = queueItems.map((item) => {
      const payload =
        item.payload &&
        typeof item.payload === "object" &&
        !Array.isArray(item.payload)
          ? (item.payload as Record<string, any>)
          : {};

      const packageIdValue = Number(
        payload.remediationPackageId,
      );

      const packageId =
        Number.isFinite(packageIdValue) &&
        packageIdValue > 0
          ? packageIdValue
          : null;

      const pkg = packageId
        ? packageById.get(packageId) ?? null
        : null;

      return {
        id: item.id,
        queue: item.queue,
        status: item.status,
        priority: item.priority,
        dueAt: item.dueAt,
        updatedAt: item.updatedAt,
        payload: item.payload,
        workflowId:
          item.WorkflowInstance?.id ??
          item.workflowId ??
          null,
        currentStage:
          item.WorkflowInstance?.currentStage ?? null,
        workflowType:
          item.WorkflowInstance?.type ?? null,
        packageId: pkg?.id ?? null,
        packageTitle: pkg?.title ?? null,
        packageStatus: pkg?.status ?? null,
        severity: pkg?.severity ?? null,
        vendorName:
          item.vendorId != null
            ? vendorById.get(item.vendorId)?.name ?? null
            : null,
        organizationName:
          organizationById.get(item.organizationId)?.name ??
          null,
        reviewAssignmentId: item.reviewAssignmentId,
      };
    });

    return NextResponse.json({
      ok: true,
      summary,
      items,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: String(
          error?.message ||
            "Failed to load workflow queue.",
        ),
      },
      { status: 500 },
    );
  }
}
