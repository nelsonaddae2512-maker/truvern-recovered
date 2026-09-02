import { NextResponse } from "next/server";
import { requireReviewerAccess } from "@/lib/auth/truvern-governance";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const REVIEWER_INTERNAL_VISIBILITY =
  "REVIEWER_INTERNAL";

type Props = {
  params: Promise<{ id: string }> | { id: string };
};

function safeStr(value: unknown) {
  return String(value ?? "").trim();
}

function canAccessPackage(
  actor: Awaited<ReturnType<typeof requireReviewerAccess>>,
  pkg: { organizationId: number },
) {
  if (actor.role === "OPS") {
    return true;
  }

  if (actor.role !== "REVIEWER") {
    return false;
  }

  if (actor.organizationId == null) {
    return true;
  }

  return actor.organizationId === pkg.organizationId;
}

async function loadPackage(packageId: number) {
  return prisma.remediationPackage.findUnique({
    where: {
      id: packageId,
    },
    select: {
      id: true,
      reviewAssignmentId: true,
      vendorId: true,
      organizationId: true,
      sourceKey: true,
    },
  });
}

export async function GET(
  _request: Request,
  props: Props,
) {
  try {
    const actor =
      await requireReviewerAccess();

    const resolved =
      await props.params;

    const packageId =
      Number(resolved.id);

    if (!Number.isFinite(packageId) || packageId <= 0) {
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

    const pkg =
      await loadPackage(packageId);

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

    if (!canAccessPackage(actor, pkg)) {
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

    const comments =
      await prisma.remediationMessage.findMany({
        where: {
          packageId: pkg.id,
          visibility:
            REVIEWER_INTERNAL_VISIBILITY,
        },
        select: {
          id: true,
          authorType: true,
          authorId: true,
          authorName: true,
          message: true,
          visibility: true,
          createdAt: true,
        },
        orderBy: [
          {
            createdAt: "asc",
          },
          {
            id: "asc",
          },
        ],
      });

    return NextResponse.json({
      ok: true,
      comments,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: String(
          error?.message ||
            "Unable to load reviewer comments.",
        ),
      },
      {
        status: 500,
      },
    );
  }
}

export async function POST(
  request: Request,
  props: Props,
) {
  try {
    const actor =
      await requireReviewerAccess();

    const resolved =
      await props.params;

    const packageId =
      Number(resolved.id);

    if (!Number.isFinite(packageId) || packageId <= 0) {
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

    const pkg =
      await loadPackage(packageId);

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

    if (!canAccessPackage(actor, pkg)) {
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

    const body =
      await request
        .json()
        .catch(() => ({}));

    const message =
      safeStr(body?.message);

    if (!message) {
      return NextResponse.json(
        {
          ok: false,
          error: "Reviewer comment cannot be empty.",
        },
        {
          status: 400,
        },
      );
    }

    if (message.length > 8000) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Reviewer comment cannot exceed 8000 characters.",
        },
        {
          status: 400,
        },
      );
    }

    const authorType =
      actor.role === "OPS"
        ? "OPS"
        : "REVIEWER";

    const authorName =
      actor.role === "OPS"
        ? "Truvern Ops"
        : "Reviewer";

    const comment =
      await prisma.remediationMessage.create({
        data: {
          packageId:
            pkg.id,

          reviewAssignmentId:
            pkg.reviewAssignmentId,

          vendorId:
            pkg.vendorId,

          organizationId:
            pkg.organizationId,

          authorType,

          authorId:
            actor.userId,

          authorName,

          message,

          visibility:
            REVIEWER_INTERNAL_VISIBILITY,
        },
        select: {
          id: true,
          authorType: true,
          authorId: true,
          authorName: true,
          message: true,
          visibility: true,
          createdAt: true,
        },
      });

    return NextResponse.json(
      {
        ok: true,
        comment,
      },
      {
        status: 201,
      },
    );
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: String(
          error?.message ||
            "Unable to add reviewer comment.",
        ),
      },
      {
        status: 500,
      },
    );
  }
}