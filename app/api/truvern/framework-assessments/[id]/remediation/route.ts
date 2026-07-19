import { NextResponse } from "next/server";
import { governanceAuthErrorResponse } from "@/lib/auth/governance-auth-errors";
import prisma from "@/lib/prisma";
import { writeGovernanceAuditLog } from "@/lib/governance/audit-log";
import { requireReviewerAccess, requireFrameworkAssessmentAccess } from "@/lib/auth/truvern-governance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteContext = {
  params: Promise<{ id: string }>;
};

function parseId(value: string) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function POST(_request: Request, context: RouteContext) {
  try {
    const { id: rawId } = await context.params;
    const id = parseId(rawId);

    if (!id) {
      return NextResponse.json({ ok: false, error: "Invalid assessment id." }, { status: 400 });
    }

    const findings = await prisma.truvernAssessmentFinding.findMany({
      where: {
        assessmentId: id,
        remediationRequired: true,
        status: {
          in: ["OPEN", "REMEDIATION_REQUESTED"],
        },
      },
      orderBy: [{ severity: "desc" }, { dueAt: "asc" }],
    });

    const remediation = await prisma.$transaction(async (tx) => {
      const created = [];

      for (const finding of findings) {
        const existing = await tx.truvernRemediationRequest.findFirst({
          where: {
            findingId: finding.id,
            status: {
              in: ["REQUESTED", "IN_PROGRESS", "SUBMITTED"],
            },
          },
        });

        if (existing) {
          created.push(existing);
          continue;
        }

        const request = await tx.truvernRemediationRequest.create({
          data: {
            findingId: finding.id,
            status: "REQUESTED",
            requestText:
              finding.recommendation ??
              "Please provide remediation evidence, corrective action, or compensating control documentation.",
            dueAt: finding.dueAt,
            metadata: {
              source: "truvern-remediation-api",
              severity: finding.severity,
              assessmentId: id,
            },
          },
        });

        await tx.truvernAssessmentFinding.update({
          where: { id: finding.id },
          data: { status: "REMEDIATION_REQUESTED" },
        });

        created.push(request);
      }

      await tx.truvernFrameworkAssessment.update({
        where: { id },
        data: {
          status: created.length > 0 ? "REMEDIATION_REQUESTED" : "READY_FOR_RELEASE",
          readyForReleaseAt: created.length > 0 ? null : new Date(),
        },
      });

      return created;
    });

    const assessment = await prisma.truvernFrameworkAssessment.findUnique({
      where: { id },
      select: { organizationId: true },
    });

    await writeGovernanceAuditLog({
      organizationId: assessment?.organizationId ?? null,
      entityType: "TruvernFrameworkAssessment",
      entityId: id,
      action: "FRAMEWORK_REMEDIATION_REQUESTED",
      message: "Framework assessment remediation requests were created.",
      metadata: {
        count: remediation.length,
      },
    });

    return NextResponse.json({
      ok: true,
      remediationRequests: remediation,
      count: remediation.length,
    });
  } catch (error) {
    const authError = governanceAuthErrorResponse(error);
    if (authError) return authError;

    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to create remediation requests." },
      { status: 500 },
    );
  }
}





