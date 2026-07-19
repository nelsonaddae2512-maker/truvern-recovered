import { NextRequest, NextResponse } from "next/server";
import { requireReviewerAccess } from "@/lib/auth/truvern-governance";
import prisma from "@/lib/prisma";

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
    const name = safeStr(body?.name) || email.split("@")[0] || "Analyst";

    if (!Number.isFinite(organizationId) || organizationId <= 0) {
      return json(400, { ok: false, error: "Valid organizationId required." });
    }

    if (!email || !email.includes("@")) {
      return json(400, { ok: false, error: "Valid analyst email required." });
    }

    const existingRows = await prisma.$queryRawUnsafe<
      Array<{ userId: string; email: string; name: string | null }>
    >(
      `
      select
        u.id::text as "userId",
        u.email::text as email,
        u.name::text as name
      from "OrgMembership" m
      join "User" u on u.id::text = m."userId"::text
      where m."organizationId"::text = $1::text
        and lower(u.email) = lower($2)
      limit 1
      `,
      String(organizationId),
      email,
    );

    if (existingRows[0]) {
      return json(200, {
        ok: true,
        analyst: {
          userId: existingRows[0].userId,
          email: existingRows[0].email,
          name: existingRows[0].name || existingRows[0].email,
        },
      });
    }

    const userRows = await prisma.$queryRawUnsafe<
      Array<{ id: string; email: string; name: string | null }>
    >(
      `
      insert into "User" (email, name, "createdAt", "updatedAt")
      values ($1, $2, now(), now())
      on conflict (email) do update
        set name = coalesce("User".name, excluded.name),
            "updatedAt" = now()
      returning id::text, email::text, name::text
      `,
      email,
      name,
    );

    const user = userRows[0];

    if (!user?.id) {
      return json(500, { ok: false, error: "Failed to create analyst user." });
    }

    await prisma.$executeRawUnsafe(
      `
      insert into "OrgMembership" ("organizationId", "userId", role, "createdAt", "updatedAt")
      values ($1::int, $2, 'ANALYST', now(), now())
      on conflict do nothing
      `,
      organizationId,
      user.id,
    );

    return json(200, {
      ok: true,
      analyst: {
        userId: user.id,
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


