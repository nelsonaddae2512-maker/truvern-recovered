import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import prisma from "@/lib/prisma";
import { requireDbOrganization } from "@/lib/org-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type EnumRow = {
  value: string;
};

export async function GET() {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json(
      {
        ok: false,
        error: "Unauthorized",
      },
      {
        status: 401,
        headers: {
          "cache-control": "no-store",
        },
      },
    );
  }

  try {
    const organization = await requireDbOrganization();

    if (!("id" in organization)) {
      return NextResponse.json(
        {
          ok: false,
          error: "Organization selection required.",
        },
        {
          status: 403,
          headers: {
            "cache-control": "no-store",
          },
        },
      );
    }

    const rows = await prisma.$queryRawUnsafe<EnumRow[]>(
      `
      select e.enumlabel as value
      from pg_enum e
      join pg_type t
        on t.oid = e.enumtypid
      join pg_namespace n
        on n.oid = t.typnamespace
      where n.nspname = 'public'
        and t.typname = 'VendorContactRole'
      order by e.enumsortorder
      `,
    );

    const roles = rows
      .map((row) => String(row.value || "").trim())
      .filter(Boolean);

    if (roles.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "No vendor contact roles are configured.",
        },
        {
          status: 503,
          headers: {
            "cache-control": "no-store",
          },
        },
      );
    }

    return NextResponse.json(
      {
        ok: true,
        roles,
      },
      {
        headers: {
          "cache-control": "no-store",
        },
      },
    );
  } catch (error) {
    console.error(
      "GET /api/vendor-contact-roles failed:",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        error: "Unable to load vendor contact roles.",
        detail:
          process.env.NODE_ENV === "development"
            ? error instanceof Error
              ? error.message
              : String(error)
            : undefined,
      },
      {
        status: 500,
        headers: {
          "cache-control": "no-store",
        },
      },
    );
  }
}