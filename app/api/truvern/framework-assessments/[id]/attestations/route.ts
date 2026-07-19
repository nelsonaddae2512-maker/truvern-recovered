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
        attestationRequired: true,
        status: {
          in: ["OPEN", "REMEDIATION_REQUESTED"],
        },
      },
      include: {
        control: {
          select: {
            controlId: true,
            family: true,
            title: true,
          },
        },
      },
      orderBy: [{ severity: "desc" }, { dueAt: "asc" }],
    });

    const attestations = await prisma.$transaction(async (tx) => {
      const created = [];

      for (const finding of findings) {
        const controlLabel = finding.control
          ? `${finding.control.controlId} · ${finding.control.title}`
          : finding.title;

        const existing = await tx.truvernAssessmentAttestation.findFirst({
          where: {
            assessmentId: id,
            title: `Attestation required: ${controlLabel}`,
            status: {
              in: ["REQUESTED", "SUBMITTED"],
            },
          },
        });

        if (existing) {
          created.push(existing);
          continue;
        }

        const attestation = await tx.truvernAssessmentAttestation.create({
          data: {
            assessmentId: id,
            title: `Attestation required: ${controlLabel}`,
            description:
              finding.recommendation ??
              "Please provide a signed attestation, certification, or formal assurance statement for this control.",
            status: "REQUESTED",
            expiresAt: finding.dueAt,
            metadata: {
              source: "truvern-attestation-api",
              findingId: finding.id,
              severity: finding.severity,
              controlId: finding.controlId,
              controlCode: finding.control?.controlId ?? null,
              family: finding.control?.family ?? null,
            },
          },
        });

        created.push(attestation);
      }

      await tx.truvernFrameworkAssessment.update({
        where: { id },
        data: {
          status: created.length > 0 ? "ATTESTATION_REQUESTED" : "READY_FOR_RELEASE",
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
      action: "FRAMEWORK_ATTESTATIONS_REQUESTED",
      message: "Framework assessment attestation requests were created.",
      metadata: {
        count: attestations.length,
      },
    });

    return NextResponse.json({
      ok: true,
      attestations,
      count: attestations.length,
    });
  } catch (error) {
    const authError = governanceAuthErrorResponse(error);
    if (authError) return authError;

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to create attestation requests.",
      },
      { status: 500 },
    );
  }
}





