import { NextResponse } from "next/server";

import prisma from "@/lib/prisma";
import { governanceAuthErrorResponse } from "@/lib/auth/governance-auth-errors";
import { requireOpsAccess } from "@/lib/auth/truvern-governance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const CANARY_ID = 1;
const EXPECTED_TITLE =
  "TRUVERN R17 GOVERNANCE RELEASE CANARY — DO NOT USE";
const EXPECTED_FRAMEWORK_SLUG =
  "nist-800-53-rev5";
const EXPECTED_FRAMEWORK_VERSION =
  "5.2.0";

export async function GET() {
  try {
    await requireOpsAccess();

    const assessment =
      await prisma.truvernFrameworkAssessment.findUnique({
        where: {
          id: CANARY_ID,
        },
        select: {
          id: true,
          title: true,
          organizationId: true,
          vendorId: true,
          assessmentRunId: true,
          reviewAssignmentId: true,
          status: true,
          score: true,
          maxScore: true,
          riskLevel: true,
          submittedAt: true,
          readyForReleaseAt: true,
          releasedAt: true,
          framework: {
            select: {
              id: true,
              slug: true,
              name: true,
              version: true,
            },
          },
          _count: {
            select: {
              responses: true,
              findings: true,
              attestations: true,
            },
          },
        },
      });

    if (!assessment) {
      return NextResponse.json(
        {
          ok: false,
          error: "R17 canary assessment not found.",
        },
        {
          status: 404,
        }
      );
    }

    const identityCertified =
      assessment.id === CANARY_ID &&
      assessment.title === EXPECTED_TITLE &&
      assessment.organizationId === null &&
      assessment.vendorId === null &&
      assessment.assessmentRunId === null &&
      assessment.reviewAssignmentId === null &&
      assessment.framework.slug ===
        EXPECTED_FRAMEWORK_SLUG &&
      assessment.framework.version ===
        EXPECTED_FRAMEWORK_VERSION;

    if (!identityCertified) {
      return NextResponse.json(
        {
          ok: false,
          error: "R17 canary identity certification failed.",
          assessment,
        },
        {
          status: 409,
        }
      );
    }

    const remediationCount =
      await prisma.truvernRemediationRequest.count({
        where: {
          finding: {
            assessmentId: CANARY_ID,
          },
        },
      });

    const findingsAudits =
      await prisma.auditLog.findMany({
        where: {
          entityType:
            "TruvernFrameworkAssessment",
          entityId:
            String(CANARY_ID),
          action:
            "FRAMEWORK_FINDINGS_GENERATED",
        },
        select: {
          id: true,
          action: true,
          message: true,
          createdAt: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      });

    const releaseAudits =
      await prisma.auditLog.findMany({
        where: {
          entityType:
            "TruvernFrameworkAssessment",
          entityId:
            String(CANARY_ID),
          action: {
            in: [
              "FRAMEWORK_RELEASE_CONFIRMED",
              "FRAMEWORK_ASSESSMENT_RELEASED",
            ],
          },
        },
        select: {
          id: true,
          action: true,
          createdAt: true,
        },
      });

    const stateCertified =
      assessment.status === "READY_FOR_RELEASE" &&
      assessment.score === 301 &&
      assessment.maxScore === 301 &&
      assessment.riskLevel === "LOW" &&
      assessment.submittedAt !== null &&
      assessment.readyForReleaseAt !== null &&
      assessment.releasedAt === null;

    const downstreamCertified =
      assessment._count.responses === 301 &&
      assessment._count.findings === 0 &&
      remediationCount === 0 &&
      assessment._count.attestations === 0;

    const auditCertified =
      findingsAudits.length >= 1 &&
      releaseAudits.length === 0;

    const certified =
      identityCertified &&
      stateCertified &&
      downstreamCertified &&
      auditCertified;

    if (!certified) {
      return NextResponse.json(
        {
          ok: false,
          certification:
            "R46G.7G-E7-M.2F-R17.24",
          state:
            "CANARY_POST_FINDINGS_CERTIFICATION_FAILED",
          identityCertified,
          stateCertified,
          downstreamCertified,
          auditCertified,
          assessment,
          remediationCount,
          findingsAudits,
          releaseAudits,
          mutation: {
            assessmentUpdated: false,
            responsesUpdated: false,
            auditWritten: false,
            releaseInvoked: false,
            signingInvoked: false,
            writePerformed: false,
          },
        },
        {
          status: 409,
        }
      );
    }

    return NextResponse.json({
      ok: true,
      certification:
        "R46G.7G-E7-M.2F-R17.24",
      state:
        "CANARY_POST_FINDINGS_CERTIFIED",
      canary: {
        id: assessment.id,
        title: assessment.title,
        status: assessment.status,
        score: assessment.score,
        maxScore: assessment.maxScore,
        riskLevel: assessment.riskLevel,
        submittedAt: assessment.submittedAt,
        readyForReleaseAt:
          assessment.readyForReleaseAt,
        releasedAt: assessment.releasedAt,
      },
      downstream: {
        responseCount:
          assessment._count.responses,
        findingCount:
          assessment._count.findings,
        remediationCount,
        attestationCount:
          assessment._count.attestations,
      },
      audit: {
        findingsGenerated:
          findingsAudits.length,
        releaseEvents:
          releaseAudits.length,
      },
      mutation: {
        assessmentUpdated: false,
        responsesUpdated: false,
        auditWritten: false,
        releaseInvoked: false,
        signingInvoked: false,
        writePerformed: false,
      },
    });
  }
  catch (error) {
    const authError =
      governanceAuthErrorResponse(error);

    if (authError) {
      return authError;
    }

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "R17.24 certification failed.",
      },
      {
        status: 500,
      }
    );
  }
}
