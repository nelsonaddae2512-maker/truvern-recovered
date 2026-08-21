import { NextRequest, NextResponse } from "next/server";
import { requireReviewerAccess } from "@/lib/auth/truvern-governance";
import prisma from "@/lib/prisma";


import {
  findFirstOrgMembership,
  upsertOrgMembership,
} from "@/lib/repositories/org-membership-repository";
import { upsertUser } from "@/lib/repositories/user-repository";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function safeStr(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function json(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

export async function POST(req: NextRequest) {
  try {
    await requireReviewerAccess();

    const body = await req.json().catch(() => ({}));

    const organizationId = Number(body?.organizationId);
    const email = safeStr(body?.email).toLowerCase();
    const name =
      safeStr(body?.name) ||
      email.split("@")[0] ||
      "Analyst";

    if (!Number.isFinite(organizationId) || organizationId <= 0) {
      return json(400, {
        ok: false,
        error: "Valid organizationId required.",
      });
    }

    if (!email || !email.includes("@")) {
      return json(400, {
        ok: false,
        error: "Valid analyst email required.",
      });
    }

    const existingMembership = await findFirstOrgMembership({
      where: {
        organizationId,
        user: {
          email: {
            equals: email,
            mode: "insensitive",
          },
        },
      },
      select: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });

    if (existingMembership) {
      const existingUser = existingMembership.user;

      return json(200, {
        ok: true,
        analyst: {
          userId: String(existingUser.id),
          email: existingUser.email,
          name: existingUser.name || existingUser.email,
        },
      });
    }

    const user = await upsertUser({
      where: {
        email,
      },
      create: {
        email,
        name,
      },
      update: {
        name: name || undefined,
      },
      select: {
        id: true,
        email: true,
        name: true,
      },
    });

    await upsertOrgMembership({
      where: {
        userId_organizationId: {
          userId: user.id,
          organizationId,
        },
      },
      create: {
        userId: user.id,
        organizationId,
        role: "ANALYST",
      },
      update: {},
    });

    return json(200, {
      ok: true,
      analyst: {
        userId: String(user.id),
        email: user.email,
        name: user.name || user.email,
      },
    });
  } catch (error: any) {
    console.error("ANALYST_CREATE_ERROR", error);

    return json(500, {
      ok: false,
      error: error?.message || "Failed to create analyst.",
    });
  }
}
