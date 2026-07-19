import { NextResponse } from "next/server";
import { governanceAuthErrorResponse } from "@/lib/auth/governance-auth-errors";
import prisma from "@/lib/prisma";
import { requireReviewerAccess } from "@/lib/auth/truvern-governance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

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

export async function GET() {
  try {
    await requireReviewerAccess();
    const frameworks = await prisma.truvernFramework.findMany({
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
      include: {
        _count: {
          select: {
            controls: true,
            assessments: true,
          },
        },
        controls: {
          select: {
            id: true,
            controlId: true,
            family: true,
            title: true,
            requirementLevel: true,
            baselineLow: true,
            baselineModerate: true,
            baselineHigh: true,
            sortOrder: true,
            _count: {
              select: {
                questions: true,
                findings: true,
              },
            },
          },
          orderBy: [{ family: "asc" }, { sortOrder: "asc" }, { controlId: "asc" }],
        },
      },
    });

    return NextResponse.json({
      ok: true,
      frameworks: frameworks.map((framework) => ({
        id: framework.id,
        slug: framework.slug,
        name: framework.name,
        description: framework.description,
        version: framework.version,
        status: framework.status,
        metadata: framework.metadata,
        createdAt: framework.createdAt,
        updatedAt: framework.updatedAt,
        counts: {
          controls: framework._count.controls,
          assessments: framework._count.assessments,
          questions: framework.controls.reduce((sum, control) => sum + control._count.questions, 0),
          findings: framework.controls.reduce((sum, control) => sum + control._count.findings, 0),
        },
        controls: framework.controls,
      })),
    });
  } catch (error) {
    const authError = governanceAuthErrorResponse(error);
    if (authError) return authError;

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to load Truvern frameworks.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    await requireReviewerAccess();

    await requireReviewerAccess();
    const body = await request.json().catch(() => ({}));

    const name = safeString(body.name);
    const version = safeString(body.version);
    const description = safeString(body.description);
    const requestedSlug = safeString(body.slug);
    const status = safeString(body.status) ?? "DRAFT";

    if (!name) {
      return NextResponse.json({ ok: false, error: "Framework name is required." }, { status: 400 });
    }

    const slug = slugify(requestedSlug ?? name);

    if (!slug) {
      return NextResponse.json({ ok: false, error: "Framework slug is required." }, { status: 400 });
    }

    if (!["DRAFT", "ACTIVE", "ARCHIVED"].includes(status)) {
      return NextResponse.json({ ok: false, error: "Invalid framework status." }, { status: 400 });
    }

    const framework = await prisma.truvernFramework.create({
      data: {
        name,
        slug,
        version,
        description,
        status: status as "DRAFT" | "ACTIVE" | "ARCHIVED",
        metadata: body.metadata && typeof body.metadata === "object" ? body.metadata : undefined,
      },
    });

    return NextResponse.json({ ok: true, framework }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create Truvern framework.";
    const status = message.includes("Unique constraint") ? 409 : 500;

    return NextResponse.json({ ok: false, error: message }, { status });
  }
}



