import { NextResponse } from "next/server";

import { requireOpsAccess } from "@/lib/auth/truvern-governance";
import { governanceAuthErrorResponse } from "@/lib/auth/governance-auth-errors";
import {
  findTruvernFrameworkAssessments,
} from "@/lib/repositories/truvern-framework-assessment-repository";
import {
  countTruvernAssessmentFindings,
} from "@/lib/repositories/truvern-assessment-finding-repository";
import {
  countTruvernRemediationRequests,
} from "@/lib/repositories/truvern-remediation-request-repository";
import {
  countTruvernAssessmentAttestations,
} from "@/lib/repositories/truvern-assessment-attestation-repository";
import {
  countTruvernAssessmentResponses,
} from "@/lib/repositories/truvern-assessment-response-repository";
import {
  readR17CanaryDatabaseIdentity,
} from "@/lib/repositories/r17-canary-database-identity-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    await requireOpsAccess();
    const databaseRows =
      await readR17CanaryDatabaseIdentity();

    const assessments =
      await findTruvernFrameworkAssessments({
        where: {
          releasedAt: null,
        },

        select: {
          id: true,
          organizationId: true,
          vendorId: true,
          frameworkId: true,
          status: true,
          createdAt: true,
          updatedAt: true,
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
        },

        orderBy: [
          {
            updatedAt: "desc",
          },
          {
            id: "desc",
          },
        ],

        take: 25,
      });

    const candidates = [];

    for (const assessment of assessments) {
      const unresolvedFindings =
        await countTruvernAssessmentFindings({
          where: {
            assessmentId:
              assessment.id,

            OR: [
              {
                remediationRequired:
                  true,

                status: {
                  in: [
                    "OPEN",
                    "REMEDIATION_REQUESTED",
                  ],
                },
              },

              {
                attestationRequired:
                  true,

                status: {
                  in: [
                    "OPEN",
                    "REMEDIATION_REQUESTED",
                  ],
                },
              },
            ],
          },
        });

      const unresolvedRemediation =
        await countTruvernRemediationRequests({
          where: {
            finding: {
              assessmentId:
                assessment.id,
            },

            status: {
              in: [
                "REQUESTED",
                "IN_PROGRESS",
                "SUBMITTED",
                "REJECTED",
              ],
            },
          },
        });

      const unresolvedAttestations =
        await countTruvernAssessmentAttestations({
          where: {
            assessmentId:
              assessment.id,

            status: {
              in: [
                "REQUESTED",
                "SUBMITTED",
                "REJECTED",
              ],
            },
          },
        });

      const responseCount =
        await countTruvernAssessmentResponses({
          where: {
            assessmentId:
              assessment.id,
          },
        });

      const findingCount =
        await countTruvernAssessmentFindings({
          where: {
            assessmentId:
              assessment.id,
          },
        });

      const attestationCount =
        await countTruvernAssessmentAttestations({
          where: {
            assessmentId:
              assessment.id,
          },
        });

      const gateClean =
        unresolvedFindings === 0 &&
        unresolvedRemediation === 0 &&
        unresolvedAttestations === 0;

      candidates.push({
        id:
          assessment.id,

        organizationId:
          assessment.organizationId,

        vendorId:
          assessment.vendorId,

        frameworkId:
          assessment.frameworkId,

        framework: {
          slug:
            assessment.framework.slug,

          name:
            assessment.framework.name,

          version:
            assessment.framework.version,
        },

        status:
          assessment.status,

        readyForReleaseAt:
          assessment.readyForReleaseAt,

        releasedAt:
          assessment.releasedAt,

        createdAt:
          assessment.createdAt,

        updatedAt:
          assessment.updatedAt,

        responseCount,
        findingCount,
        attestationCount,

        unresolved: {
          findings:
            unresolvedFindings,

          remediation:
            unresolvedRemediation,

          attestations:
            unresolvedAttestations,
        },

        gateClean,
      });
    }

    const canonicalCandidates =
      candidates.filter(
        (candidate) =>
          candidate.framework.slug ===
            "nist-800-53-rev5" &&
          candidate.framework.version ===
            "5.2.0",
      );

    const cleanCandidates =
      canonicalCandidates.filter(
        (candidate) =>
          candidate.gateClean,
      );

    return NextResponse.json({
      ok: true,

      certification:
        "R46G.7G-E7-M.2F-R17.3-R1",

      state:
        "PRODUCTION_CANARY_CANDIDATES_DISCOVERED",

      database: {
        name:
          databaseRows[0]?.databaseName ??
          null,

        schema:
          databaseRows[0]?.schemaName ??
          null,

        credentialsExposed:
          false,
      },

      inventory: {
        unreleasedAssessments:
          assessments.length,

        canonicalCandidates:
          canonicalCandidates.length,

        cleanCandidates:
          cleanCandidates.length,
      },

      candidates:
        cleanCandidates,

      mutations: {
        assessmentCreated:
          false,

        assessmentUpdated:
          false,

        auditWritten:
          false,

        releaseInvoked:
          false,

        signingInvoked:
          false,
      },
    });
  } catch (error) {
    const authError =
      governanceAuthErrorResponse(error);

    if (authError) {
      return authError;
    }

    return NextResponse.json(
      {
        ok: false,

        certification:
          "R46G.7G-E7-M.2F-R17.3-R1",

        state:
          "PRODUCTION_CANARY_DISCOVERY_FAILED",

        error:
          error instanceof Error
            ? error.message
            : String(error),

        mutations: {
          assessmentCreated:
            false,

          assessmentUpdated:
            false,

          auditWritten:
            false,

          releaseInvoked:
            false,

          signingInvoked:
            false,
        },
      },
      {
        status: 500,
      },
    );
  }
}