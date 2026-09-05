import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  requireGovernanceCapability,
  requireReviewerAccess
} from "@/lib/auth/truvern-governance";
import { emitWorkflowEvent } from "@/lib/workflow/workflow-events";
import { WorkflowEvent } from "@/lib/workflow/workflow-constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = {
  params: Promise<{ id: string }> | { id: string };
};

export async function POST(request: Request, props: Props) {
  try {
    const actor = await requireReviewerAccess();
    requireGovernanceCapability(
      actor,
      "governance.approve",
    );
    const resolved = await props.params;
    const packageId = Number(resolved.id);
    const body = await request.json().catch(() => ({}));

    if (!Number.isFinite(packageId) || packageId <= 0) {
      return NextResponse.json({ ok: false, error: "Remediation package id required." }, { status: 400 });
    }

    const pkg =
      await prisma.remediationPackage.findUnique({
        where: {
          id: packageId,
        },
        select: {
          id: true,
          organizationId: true,
        },
      });

    if (!pkg) {
      return NextResponse.json(
        {
          ok: false,
          error: "Remediation package not found.",
        },
        {
          status: 404,
        },
      );
    }

    if (
      actor.role !== "OPS" &&
      (
        actor.organizationId == null ||
        actor.organizationId !== pkg.organizationId
      )
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Reviewer does not have access to this remediation package.",
        },
        {
          status: 403,
        },
      );
    }

    const result = await emitWorkflowEvent({
      event: WorkflowEvent.PackageApproved,
      packageId,
      actor: actor.role,
      summary: body?.summary || "Truvern approved the remediation package.",
      payload: {
        rationale: body?.rationale || "",
        reviewerName: actor.userId,
      },
    });

    return NextResponse.json({
      ...result,
      ok: true,
      packageId,
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: String(error?.message || "Failed to approve remediation package.") },
      { status: 500 },
    );
  }
}


