import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireOpsAccess } from "@/lib/auth/truvern-governance";
import { runLockedAiReviewCanaryTask18Package31 } from "@/lib/workflow/ai-review-worker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const CERTIFICATION =
  "R22.7F.10CE-R74";

const EXPECTED_TASK_ID = 18;
const EXPECTED_PACKAGE_ID = 31;

const CONFIRMATION =
  "EXECUTE-R74-TERRA-CANARY-TASK-18-PACKAGE-31";

type CanaryCandidate = {
  taskId: number;
  packageId: number;
  assignmentType: string | null;
  taskStatus: string;
  matchingTasksInPackage: number;
};

export async function POST(request: Request) {
  await requireOpsAccess();

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        ok: false,
        certification: CERTIFICATION,
        error: "INVALID_JSON",
        workerInvoked: false,
        modelCalled: false,
      },
      { status: 400 },
    );
  }

  const confirmation =
    typeof body === "object" &&
    body !== null &&
    "confirmation" in body
      ? String(
          (body as { confirmation?: unknown }).confirmation ?? "",
        ).trim()
      : "";

  if (confirmation !== CONFIRMATION) {
    return NextResponse.json(
      {
        ok: false,
        certification: CERTIFICATION,
        error: "CONFIRMATION_REQUIRED",
        workerInvoked: false,
        modelCalled: false,
      },
      { status: 400 },
    );
  }

  const candidates =
    await prisma.$queryRaw<CanaryCandidate[]>`
      select
        wt.id::int as "taskId",
        wt."packageId"::int as "packageId",
        ra."assignmentType"::text as "assignmentType",
        wt.status::text as "taskStatus",
        (
          select count(*)::int
          from "WorkflowTask" package_task
          where package_task.type = 'AI_PRE_REVIEW'
            and package_task.status = 'OPEN'
            and package_task."packageId" = wt."packageId"
        ) as "matchingTasksInPackage"
      from "WorkflowTask" wt
      left join "ReviewAssignment" ra
        on ra.id = wt."reviewAssignmentId"
        and ra."organizationId" = wt."organizationId"
        and ra."vendorId" = wt."vendorId"
      where wt.id = ${EXPECTED_TASK_ID}
        and wt."packageId" = ${EXPECTED_PACKAGE_ID}
        and wt.type = 'AI_PRE_REVIEW'
        and wt.status = 'OPEN'
      limit 2
    `;

  if (candidates.length !== 1) {
    return NextResponse.json(
      {
        ok: false,
        certification: CERTIFICATION,
        error: "EXPECTED_TASK_NOT_EXACTLY_ONE",
        expectedTaskId: EXPECTED_TASK_ID,
        expectedPackageId: EXPECTED_PACKAGE_ID,
        candidateCount: candidates.length,
        workerInvoked: false,
        modelCalled: false,
      },
      { status: 409 },
    );
  }

  const candidate = candidates[0];

  if (
    candidate.taskId !== EXPECTED_TASK_ID ||
    candidate.packageId !== EXPECTED_PACKAGE_ID ||
    candidate.assignmentType !== "TRUVERN" ||
    candidate.matchingTasksInPackage !== 1
  ) {
    return NextResponse.json(
      {
        ok: false,
        certification: CERTIFICATION,
        error: "CANARY_PREFLIGHT_FAILED",
        expectedTaskId: EXPECTED_TASK_ID,
        expectedPackageId: EXPECTED_PACKAGE_ID,
        observed: {
          taskId: candidate.taskId,
          packageId: candidate.packageId,
          assignmentType: candidate.assignmentType,
          taskStatus: candidate.taskStatus,
          matchingTasksInPackage:
            candidate.matchingTasksInPackage,
        },
        workerInvoked: false,
        modelCalled: false,
      },
      { status: 409 },
    );
  }

  const result =
    await runLockedAiReviewCanaryTask18Package31();

  if (
    "ok" in result &&
    result.ok === false
  ) {
    return NextResponse.json(
      {
        ok: false,
        certification: CERTIFICATION,
        error:
          "error" in result
            ? result.error
            : "CANARY_WORKER_FAILED_WITHOUT_ERROR",
        expectedTaskId: EXPECTED_TASK_ID,
        expectedPackageId: EXPECTED_PACKAGE_ID,
        workerInvoked: true,
        modelCalled: false,
        result,
      },
      { status: 409 },
    );
  }

  if (
    result.checked !== 1 ||
    result.completed !== 1
  ) {
    return NextResponse.json(
      {
        ok: false,
        certification: CERTIFICATION,
        error: "CANARY_WORKER_DID_NOT_COMPLETE_EXACTLY_ONE",
        expectedTaskId: EXPECTED_TASK_ID,
        expectedPackageId: EXPECTED_PACKAGE_ID,
        workerInvoked: true,
        result,
      },
      { status: 409 },
    );
  }

  return NextResponse.json({
    ok: true,
    certification: CERTIFICATION,
    expectedTaskId: EXPECTED_TASK_ID,
    expectedPackageId: EXPECTED_PACKAGE_ID,
    workerInvoked: true,
    humanReviewRequired: true,
    result,
  });
}
