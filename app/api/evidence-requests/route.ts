import { NextResponse } from "next/server";
import {
  requireReviewerAccess,
  requireReviewAssignmentAccess,
} from "@/lib/auth/truvern-governance";
import {
  governanceAuthErrorResponse,
  governanceForbidden,
} from "@/lib/auth/governance-auth-errors";
import { findVendor } from "@/lib/repositories/vendor-repository";
import { insertEvidenceRequest } from "@/lib/repositories/evidence-request-write-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function safeStr(v: unknown) {
  return typeof v === "string" ? v.trim() : "";
}

function json(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

function positiveInt(v: unknown) {
  const n = Number(v);

  return Number.isInteger(n) && n > 0
    ? n
    : null;
}

function normalizeKind(v: unknown) {
  const s = safeStr(v).toUpperCase();

  if (s === "PENTEST" || s === "PEN_TEST" || s === "REPORT") {
    return "OTHER";
  }

  if (
    ["SOC2", "ISO27001", "POLICY", "BCP_DRP", "OTHER"].includes(s)
  ) {
    return s;
  }

  return "OTHER";
}

export async function POST(req: Request) {
  try {
    const body =
      await req.json().catch(() => ({}));

    const requestedVendorId =
      positiveInt(body?.vendorId);

    const reviewAssignmentIdRaw =
      body?.reviewAssignmentId;

    const hasReviewAssignmentId =
      reviewAssignmentIdRaw !== undefined &&
      reviewAssignmentIdRaw !== null &&
      reviewAssignmentIdRaw !== "";

    const reviewAssignmentId =
      hasReviewAssignmentId
        ? positiveInt(reviewAssignmentIdRaw)
        : null;

    if (!requestedVendorId) {
      return json(400, {
        ok: false,
        error: "Vendor id required",
      });
    }

    if (
      hasReviewAssignmentId &&
      !reviewAssignmentId
    ) {
      return json(400, {
        ok: false,
        error: "Valid review assignment id required.",
      });
    }

    const kind =
      normalizeKind(body?.kind);

    const title =
      safeStr(body?.label || body?.title) ||
      "Evidence request";

    const dueAtRaw =
      safeStr(body?.dueAt);

    const dueAtDate =
      dueAtRaw
        ? new Date(dueAtRaw)
        : null;

    const dueAt =
      dueAtDate &&
      !Number.isNaN(dueAtDate.getTime())
        ? dueAtDate
        : null;

    let actorUserId: string;
    let vendorId: number;
    let organizationId: number;

    if (reviewAssignmentId) {
      const {
        actor,
        assignment,
      } =
        await requireReviewAssignmentAccess(
          reviewAssignmentId,
        );

      if (
        assignment.vendorId !==
        requestedVendorId
      ) {
        throw governanceForbidden(
          "Vendor does not match this review assignment.",
        );
      }

      actorUserId =
        actor.userId;

      vendorId =
        assignment.vendorId;

      organizationId =
        assignment.organizationId;
    } else {
      const actor =
        await requireReviewerAccess();

      const vendor =
        await findVendor({
          where: {
            id: requestedVendorId,
          },
          select: {
            id: true,
            organizationId: true,
          },
        });

      if (
        !vendor ||
        !Number.isFinite(
          Number(vendor.organizationId),
        )
      ) {
        return json(404, {
          ok: false,
          error: "Vendor not found.",
        });
      }

      vendorId =
        Number(vendor.id);

      organizationId =
        Number(vendor.organizationId);

      if (
        actor.role ===
        "TRUVERN_REVIEWER"
      ) {
        throw governanceForbidden(
          "Truvern reviewers must create evidence requests from an authorized review assignment.",
        );
      }

      if (
        actor.role !== "OPS" &&
        (
          actor.organizationId == null ||
          actor.organizationId !==
            organizationId
        )
      ) {
        throw governanceForbidden(
          "You do not have access to this vendor.",
        );
      }

      actorUserId =
        actor.userId;
    }

    const rows =
      await insertEvidenceRequest({
        vendorId,
        organizationId,
        requestedBy: actorUserId,
        kind,
        title,
        dueAt,
      });

    const id =
      rows?.[0]?.id ?? null;

    if (!id) {
      return json(500, {
        ok: false,
        error:
          "Evidence request was not created.",
      });
    }

    return json(200, {
      ok: true,
      id,
      vendorId,
      organizationId,
      reviewAssignmentId:
        reviewAssignmentId ?? null,
      message:
        "Evidence request created.",
    });
  } catch (error: unknown) {
    const authResponse =
      governanceAuthErrorResponse(error);

    if (authResponse) {
      return authResponse;
    }

    console.error(
      "Evidence request creation failed:",
      error,
    );

    const message =
      error instanceof Error
        ? safeStr(error.message)
        : "";

    return json(500, {
      ok: false,
      error:
        message ||
        "Failed to create evidence request.",
    });
  }
}
