import { NextResponse } from "next/server";
import { governanceAuthErrorResponse } from "@/lib/auth/governance-auth-errors";
import prisma from "@/lib/prisma";
import { requireReleasePacketAccess } from "@/lib/auth/truvern-governance";
import {
  buildFrameworkReleaseSnapshot,
  checksumSnapshot,
} from "@/lib/governance/framework-release";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteContext = {
  params: Promise<{ id: string }>;
};

function parseId(value: unknown) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id: rawId } = await context.params;
    const assessmentId = parseId(rawId);

    if (!assessmentId) {
      return NextResponse.json({ ok: false, error: "Invalid assessment id." }, { status: 400 });
    }

    await requireReleasePacketAccess(assessmentId);

    const assessment = await prisma.truvernFrameworkAssessment.findUnique({
      where: { id: assessmentId },
      include: {
        framework: true,
        responses: {
          include: {
            question: {
              include: {
                control: true,
              },
            },
          },
          orderBy: [{ questionId: "asc" }],
        },
        findings: {
          include: {
            remediations: {
              orderBy: [{ createdAt: "asc" }],
            },
          },
          orderBy: [{ createdAt: "asc" }],
        },
        attestations: {
          orderBy: [{ createdAt: "asc" }],
        },
      },
    });

    if (!assessment) {
      return NextResponse.json({ ok: false, error: "Assessment not found." }, { status: 404 });
    }

    const metadata = assessment.metadata && typeof assessment.metadata === "object" ? assessment.metadata as any : {};
    const seal = metadata.governanceSeal ?? null;
    const storedSnapshot = metadata.governanceReleaseSnapshot ?? null;

    if (!seal || !storedSnapshot) {
      return NextResponse.json({
        ok: true,
        verified: false,
        reason: "Assessment has not been released or sealed.",
      });
    }

    const recalculatedFromStored = checksumSnapshot(storedSnapshot);
    const currentSnapshot = buildFrameworkReleaseSnapshot(assessment);
    const recalculatedFromCurrent = checksumSnapshot(currentSnapshot);

    return NextResponse.json({
      ok: true,
      verified: recalculatedFromStored === seal.checksum,
      storedChecksum: seal.checksum,
      recalculatedFromStored,
      currentChecksum: recalculatedFromCurrent,
      currentMatchesReleasedSnapshot: recalculatedFromCurrent === seal.checksum,
      seal,
      schema: storedSnapshot.schema,
    });
  } catch (error) {
    const authError = governanceAuthErrorResponse(error);
    if (authError) return authError;

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to verify framework assessment release.",
      },
      { status: 500 },
    );
  }
}




