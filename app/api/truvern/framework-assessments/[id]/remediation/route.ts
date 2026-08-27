import { NextResponse } from "next/server";
import { governanceAuthErrorResponse } from "@/lib/auth/governance-auth-errors";
import prisma from "@/lib/prisma";
import { writeGovernanceAuditLog } from "@/lib/governance/audit-log";
import { requireReviewerAccess, requireFrameworkAssessmentAccess } from "@/lib/auth/truvern-governance";
import { findTruvernFrameworkAssessment } from "@/lib/repositories/truvern-framework-assessment-repository";
import { updateTruvernFrameworkAssessment } from "@/lib/repositories/truvern-framework-assessment-repository";
import { findTruvernAssessmentFindings } from "@/lib/repositories/truvern-assessment-finding-repository";
import { updateTruvernAssessmentFinding } from "@/lib/repositories/truvern-assessment-finding-repository";
import { findFirstTruvernRemediationRequest } from "@/lib/repositories/truvern-remediation-request-repository";
import { createTruvernRemediationRequest } from "@/lib/repositories/truvern-remediation-request-repository";

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

    await requireReviewerAccess();
    await requireFrameworkAssessmentAccess(id);

    const findings = await findTruvernAssessmentFindings({
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
        const existing = await findFirstTruvernRemediationRequest({
          where: {
            findingId: finding.id,
            status: {
              in: ["REQUESTED", "IN_PROGRESS", "SUBMITTED"],
            },
          },
        }, tx);

        if (existing) {
          created.push(existing);
          continue;
        }

        const request = await createTruvernRemediationRequest({
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
        }, tx);

        await updateTruvernAssessmentFinding({
          where: { id: finding.id },
          data: { status: "REMEDIATION_REQUESTED" },
        }, tx);

        created.push(request);
      }

      await updateTruvernFrameworkAssessment({
        where: { id },
        data: {
          status: created.length > 0 ? "REMEDIATION_REQUESTED" : "READY_FOR_RELEASE",
          readyForReleaseAt: created.length > 0 ? null : new Date(),
        },
      }, tx);

      return created;
    });

    const assessment = await findTruvernFrameworkAssessment({
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




