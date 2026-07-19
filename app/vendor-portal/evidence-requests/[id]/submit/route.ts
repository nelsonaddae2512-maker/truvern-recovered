// app/api/vendor-portal/evidence-requests/[id]/submit/route.ts
import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function json(data: any, status = 200) {
  return NextResponse.json(data, { status });
}

function h(req: Request, key: string) {
  return (req.headers.get(key) || "").trim();
}

function isTruthy(v: string) {
  const s = (v || "").trim().toLowerCase();
  return s === "1" || s === "true" || s === "yes" || s === "on";
}

function normalizeEmail(v?: string | null) {
  const s = (v || "").trim().toLowerCase();
  return s || null;
}

function parseId(raw: unknown): number | null {
  const n = typeof raw === "string" ? Number(raw) : NaN;
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.floor(n);
}

function parseEvidenceIds(raw: any): number[] | null {
  if (!Array.isArray(raw)) return null;
  const out: number[] = [];
  for (const v of raw) {
    const n = Number(v);
    if (!Number.isFinite(n) || n <= 0) return null;
    out.push(Math.floor(n));
  }
  return Array.from(new Set(out));
}

type Actor = {
  email: string | null;
  clerkUserId: string | null;
  via: "dev" | "clerk";
};

async function resolveActor(req: Request): Promise<Actor | null> {
  const dev = isTruthy(h(req, "x-dev-bypass"));
  if (dev) {
    const email = normalizeEmail(h(req, "x-dev-email"));
    if (!email) return null;
    return { email, clerkUserId: null, via: "dev" };
  }

  const a = await auth();
  if (!a?.userId) return null;

  const u = await currentUser();
  const primary = u?.primaryEmailAddress?.emailAddress;
  const email =
    normalizeEmail(primary) ||
    normalizeEmail(u?.emailAddresses?.[0]?.emailAddress) ||
    null;

  if (!email) return null;
  return { email, clerkUserId: a.userId, via: "clerk" };
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idStr } = await ctx.params;
    const id = parseId(idStr);
    if (!id) return json({ ok: false, error: "Invalid id" }, 400);

    const actor = await resolveActor(req);
    if (!actor) {
      return json(
        { ok: false, error: "UNAUTHORIZED", reason: "Missing auth/dev email." },
        401
      );
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return json({ ok: false, error: "Invalid JSON body" }, 400);
    }

    const evidenceIds = parseEvidenceIds((body as any).evidenceIds);
    if (!evidenceIds || evidenceIds.length === 0) {
      return json(
        { ok: false, error: "evidenceIds must be a non-empty array of ints" },
        400
      );
    }

    const noteRaw = (body as any).note;
    const submitNote =
      typeof noteRaw === "string" ? noteRaw.trim().slice(0, 4000) : null;

    const er = await prisma.evidenceRequest.findUnique({
      where: { id },
      include: {
        vendor: {
          select: { id: true, organizationId: true },
        },
      },
    });

    if (!er) return json({ ok: false, error: "Not found" }, 404);

    // Strict transition
    if (er.status !== "OPEN") {
      return json(
        { ok: false, error: "Request is not open for submission" },
        409
      );
    }

    const orgId = er.vendor.organizationId;

    // Vendor-portal tenancy: actor must map to this vendor + org via VendorPortalUser
    const vpu = await prisma.vendorPortalUser.findFirst({
      where: {
        organizationId: orgId,
        vendorId: er.vendorId,
        OR: [
          actor.clerkUserId ? { clerkUserId: actor.clerkUserId } : undefined,
          actor.email ? { email: actor.email } : undefined,
        ].filter(Boolean) as any,
      },
      select: { id: true, clerkUserId: true },
    });

    if (!vpu) {
      return json(
        {
          ok: false,
          error: "FORBIDDEN",
          reason: "Actor is not linked to this vendor portal user.",
        },
        403
      );
    }

    // Evidence tenancy: evidence must belong to same vendor + org
    const count = await prisma.evidence.count({
      where: {
        id: { in: evidenceIds },
        vendorId: er.vendorId,
        organizationId: orgId,
      },
    });

    if (count !== evidenceIds.length) {
      return json(
        {
          ok: false,
          error:
            "One or more evidenceIds are invalid or not owned by this vendor.",
        },
        409
      );
    }

    const result = await prisma.$transaction(async (tx: any) => {
      // Create iteration
      const iteration = await tx.evidenceRequestIteration.create({
        data: {
          evidenceRequestId: er.id,
submittedBy: actor.email,
          submittedAt: new Date(),
},
        select: { id: true },
      });

      // Attach evidence to request + iteration; mark evidence as SUBMITTED
      await tx.evidence.updateMany({
        where: {
          id: { in: evidenceIds },
          vendorId: er.vendorId,
          organizationId: orgId,
        },
        data: {
          evidenceRequestId: er.id,
          iterationId: iteration.id,
},
      });

      // Update request current state
      const updated = await tx.evidenceRequest.update({
        where: { id: er.id },
        data: {
submittedAt: new Date(),
        },
        select: { id: true, status: true, submittedAt: true },
      });

      // Timeline event
      return { updated, iterationId: iteration.id };
    });

    return json(
      {
        ok: true,
        evidenceRequest: result.updated,
        iterationId: result.iterationId,
      },
      200
    );
  } catch (e: any) {
    return json(
      { ok: false, error: "Internal error", detail: String(e?.message || e) },
      500
    );
  }
}








