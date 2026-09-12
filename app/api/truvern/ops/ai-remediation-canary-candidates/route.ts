import { NextResponse } from "next/server";

import { requireOpsAccess } from "@/lib/auth/truvern-governance";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type CandidateRow = {
  taskId: number;
  packageId: number;
  workflowId: number | null;
  reviewAssignmentId: number;
  vendorId: number;
  organizationId: number;
  taskStatus: string;
  taskPriority: number;
  taskCreatedAt: Date;
  packageTitle: string;
  packageStatus: string;
  evidenceRequestId: number | null;
  assignmentType: string | null;
};

export async function GET() {
  await requireOpsAccess();

  try {
    const candidates = await prisma.$queryRaw<CandidateRow[]>`
      select
        wt.id as "taskId",
        wt."packageId" as "packageId",
        wt."workflowId" as "workflowId",
        wt."reviewAssignmentId" as "reviewAssignmentId",
        wt."vendorId" as "vendorId",
        wt."organizationId" as "organizationId",
        wt.status as "taskStatus",
        wt.priority as "taskPriority",
        wt."createdAt" as "taskCreatedAt",
        rp.title as "packageTitle",
        rp.status as "packageStatus",
        rp."evidenceRequestId" as "evidenceRequestId",
        ra."assignmentType" as "assignmentType"
      from "WorkflowTask" wt
      inner join "RemediationPackage" rp
        on rp.id = wt."packageId"
        and rp."reviewAssignmentId" = wt."reviewAssignmentId"
        and rp."vendorId" = wt."vendorId"
        and rp."organizationId" = wt."organizationId"
      inner join "ReviewAssignment" ra
        on ra.id = wt."reviewAssignmentId"
        and ra."vendorId" = wt."vendorId"
        and ra."organizationId" = wt."organizationId"
      where wt.type = 'AI_PRE_REVIEW'
        and wt.status in ('OPEN', 'IN_PROGRESS')
        and wt."packageId" is not null
        and wt."reviewAssignmentId" is not null
        and wt."vendorId" is not null
      order by
        wt.priority desc,
        wt."createdAt" asc,
        wt.id asc
      limit 25
    `;

    return NextResponse.json(
      {
        ok: true,
        certification: "R22.7F.10CE-R60",
        readOnly: true,
        candidateCount: candidates.length,
        candidates,
        payloadReturned: false,
        evidenceContentReturned: false,
        evidenceStorageKeyReturned: false,
        workerInvoked: false,
        providerInvoked: false,
        modelCalled: false,
        releaseAuthorityExercised: false,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch {
    return NextResponse.json(
      {
        ok: false,
        certification: "R22.7F.10CE-R60",
        error: "Candidate probe failed.",
      },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }
}
