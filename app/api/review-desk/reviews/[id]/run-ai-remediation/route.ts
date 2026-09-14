import { NextResponse } from "next/server";

import { requireReviewerAccess } from "@/lib/auth/truvern-governance";
import { findRemediationPackages } from "@/lib/repositories/remediation-package-repository";
import { findReviewAssignment } from "@/lib/repositories/review-assignment-repository";
import { isTruvernOperator } from "@/lib/truvern-ops-access";
import { runAiReviewWorkerForPackage } from "@/lib/workflow/ai-review-worker";

type Props = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(req: Request, props: Props) {
  try {
    const actor = await requireReviewerAccess();

    const canManageTruvernReview =
      await isTruvernOperator();

    if (
      actor.role !== "OPS" ||
      !canManageTruvernReview
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: "Forbidden.",
        },
        {
          status: 403,
        },
      );
    }

    const resolved = await props.params;
    const assignmentId = Number(resolved?.id);

    if (
      !Number.isFinite(assignmentId) ||
      assignmentId <= 0
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: "Assignment id required.",
        },
        {
          status: 400,
        },
      );
    }

    const body =
      await req.json().catch(() => ({}));

    const packageId =
      Number(body?.packageId);

    if (
      !Number.isFinite(packageId) ||
      packageId <= 0
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: "Remediation package id required.",
        },
        {
          status: 400,
        },
      );
    }

    const assignment =
      await findReviewAssignment({
        where: {
          id: assignmentId,
        },
        select: {
          id: true,
          assignmentType: true,
        },
      });

    if (!assignment) {
      return NextResponse.json(
        {
          ok: false,
          error: "Review assignment not found.",
        },
        {
          status: 404,
        },
      );
    }

    if (
      String(
        assignment.assignmentType ?? "",
      )
        .trim()
        .toUpperCase() !== "TRUVERN"
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "AI remediation review is restricted to Truvern reviews.",
        },
        {
          status: 403,
        },
      );
    }

    const packages =
      await findRemediationPackages({
        where: {
          id: packageId,
          reviewAssignmentId:
            assignmentId,
        },
        select: {
          id: true,
          reviewAssignmentId: true,
          evidenceRequestId: true,
          status: true,
        },
        take: 2,
      });

    if (packages.length !== 1) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Remediation package not found for this review assignment.",
        },
        {
          status: 404,
        },
      );
    }

    const remediationPackage =
      packages[0];

    if (
      remediationPackage.evidenceRequestId == null
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Remediation package is not linked to an evidence request.",
        },
        {
          status: 409,
        },
      );
    }

    const result =
      await runAiReviewWorkerForPackage(
        remediationPackage.id,
      );

    return NextResponse.json({
      ok: result.ok,
      assignmentId,
      packageId:
        remediationPackage.id,
      checked:
        result.checked,
      completed:
        result.completed,
    });
  } catch (error: any) {
    const message =
      error?.message ||
      "AI remediation review failed.";

    const status =
      message ===
      "AI_REMEDIATION_PROVIDER_BUDGET_EXHAUSTED"
        ? 429
        : 500;

    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      {
        status,
      },
    );
  }
}
