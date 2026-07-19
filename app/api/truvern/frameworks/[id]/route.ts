import { NextResponse } from "next/server";
import { governanceAuthErrorResponse } from "@/lib/auth/governance-auth-errors";
import prisma from "@/lib/prisma";
import { requireReviewerAccess } from "@/lib/auth/truvern-governance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function parseFrameworkWhere(id: string) {
  const numericId = Number(id);

  if (Number.isInteger(numericId) && numericId > 0) {
    return { id: numericId };
  }

  return { slug: id };
}

function safeString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    await requireReviewerAccess();
    const { id } = await context.params;

    const framework = await prisma.truvernFramework.findUnique({
      where: parseFrameworkWhere(id),
      include: {
        controls: {
          include: {
            questions: {
              orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
            },
            _count: {
              select: {
                findings: true,
              },
            },
          },
          orderBy: [{ family: "asc" }, { sortOrder: "asc" }, { controlId: "asc" }],
        },
        assessments: {
          select: {
            id: true,
            title: true,
            status: true,
            score: true,
            maxScore: true,
            riskLevel: true,
            vendorId: true,
            organizationId: true,
            createdAt: true,
            updatedAt: true,
            releasedAt: true,
          },
          orderBy: [{ updatedAt: "desc" }],
          take: 25,
        },
        _count: {
          select: {
            controls: true,
            assessments: true,
          },
        },
      },
    });

    if (!framework) {
      return NextResponse.json({ ok: false, error: "Framework not found." }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      framework: {
        ...framework,
        counts: {
          controls: framework._count.controls,
          assessments: framework._count.assessments,
          questions: framework.controls.reduce((sum, control) => sum + control.questions.length, 0),
          findings: framework.controls.reduce((sum, control) => sum + control._count.findings, 0),
        },
      },
    });
  } catch (error) {
    const authError = governanceAuthErrorResponse(error);
    if (authError) return authError;

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to load Truvern framework.",
      },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    await requireReviewerAccess();

    await requireReviewerAccess();
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));

    const data: {
      name?: string;
      slug?: string;
      version?: string | null;
      description?: string | null;
      status?: "DRAFT" | "ACTIVE" | "ARCHIVED";
      metadata?: object;
    } = {};

    const name = safeString(body.name);
    const slug = safeString(body.slug);
    const version = typeof body.version === "string" ? body.version.trim() || null : undefined;
    const description = typeof body.description === "string" ? body.description.trim() || null : undefined;
    const status = safeString(body.status);

    if (name) data.name = name;
    if (slug) data.slug = slugify(slug);
    if (version !== undefined) data.version = version;
    if (description !== undefined) data.description = description;

    if (status) {
      if (!["DRAFT", "ACTIVE", "ARCHIVED"].includes(status)) {
        return NextResponse.json({ ok: false, error: "Invalid framework status." }, { status: 400 });
      }

      data.status = status as "DRAFT" | "ACTIVE" | "ARCHIVED";
    }

    if (body.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata)) {
      data.metadata = body.metadata;
    }

    const framework = await prisma.truvernFramework.update({
      where: parseFrameworkWhere(id),
      data,
    });

    return NextResponse.json({ ok: true, framework });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update Truvern framework.";
    const status = message.includes("Record to update not found") ? 404 : 500;

    return NextResponse.json({ ok: false, error: message }, { status });
  }
}



