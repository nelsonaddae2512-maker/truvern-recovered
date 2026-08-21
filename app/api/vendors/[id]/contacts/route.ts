import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import prisma from "@/lib/prisma";
import { requireDbOrganization } from "@/lib/org-db";
import { findFirstVendor } from "@/lib/repositories/vendor-repository";
import { updateVendor } from "@/lib/repositories/vendor-repository";
import {
  clearPrimaryVendorContacts,
  findVendorContactByEmail,
  insertVendorContactRow,
  readAllowedVendorContactRoles,
  updateVendorContactRow,
} from "@/lib/repositories/vendor-contacts-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type Params = {
  params: Promise<{ id: string }> | { id: string };
};

type ContactPayload = {
  name?: unknown;
  email?: unknown;
  role?: unknown;
  phone?: unknown;
  isPrimary?: unknown;
};

function parseId(value: unknown) {
  const parsed = Number(String(value ?? "").trim());

  return Number.isFinite(parsed) && parsed > 0
    ? Math.floor(parsed)
    : null;
}

function parseBoolean(value: unknown) {
  if (typeof value === "boolean") {
    return value;
  }

  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();

  return ["true", "1", "on", "yes"].includes(normalized);
}


async function getAllowedContactRoles() {
  const rows = await readAllowedVendorContactRoles();

  return new Set(
    rows
      .map((row) =>
        String(row.value || "").trim(),
      )
      .filter(Boolean),
  );
}

async function readPayload(req: Request): Promise<ContactPayload> {
  const contentType = req.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return req.json().catch(() => ({}));
  }

  const form = await req.formData();

  return {
    name: form.get("name"),
    email: form.get("email"),
    role: form.get("role"),
    phone: form.get("phone"),
    isPrimary: form.get("isPrimary"),
  };
}

async function requireApiAuth() {
  const { userId } = await auth();

  if (!userId) {
    return {
      ok: false as const,
      response: NextResponse.json(
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
      ),
    };
  }

  try {
    const org = await requireDbOrganization();

    if (!("id" in org)) {
      return {
        ok: false as const,
        response: NextResponse.json(
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
        ),
      };
    }

    return {
      ok: true as const,
      userId,
      organizationId: org.id,
    };
  } catch {
    return {
      ok: false as const,
      response: NextResponse.json(
        {
          ok: false,
          error: "Organization required.",
        },
        {
          status: 403,
          headers: {
            "cache-control": "no-store",
          },
        },
      ),
    };
  }
}

export async function POST(req: Request, { params }: Params) {
  const gate = await requireApiAuth();

  if (!gate.ok) {
    return gate.response;
  }

  try {
    const resolvedParams = await params;
    const vendorId = parseId(resolvedParams.id);

    if (!vendorId) {
      return NextResponse.json(
        {
          ok: false,
          error: "Invalid vendor id.",
        },
        {
          status: 400,
          headers: {
            "cache-control": "no-store",
          },
        },
      );
    }

    const payload = await readPayload(req);

    const name = String(payload.name ?? "").trim();
    const email = String(payload.email ?? "")
      .trim()
      .toLowerCase();
    const phone = String(payload.phone ?? "").trim();

    const requestedRole = String(payload.role ?? "")
      .trim();

    const allowedRoles =
      await getAllowedContactRoles();

    if (
      !requestedRole ||
      !allowedRoles.has(requestedRole)
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: "Select a valid contact role.",
          allowedRoles: Array.from(allowedRoles),
        },
        {
          status: 400,
          headers: {
            "cache-control": "no-store",
          },
        },
      );
    }

    const role = requestedRole;const isPrimary = parseBoolean(payload.isPrimary);

    if (!name || !email) {
      return NextResponse.json(
        {
          ok: false,
          error: "Contact name and email are required.",
        },
        {
          status: 400,
          headers: {
            "cache-control": "no-store",
          },
        },
      );
    }

    const vendor = await findFirstVendor({
      where: {
        id: vendorId,
        organizationId: gate.organizationId,
      },
      select: {
        id: true,
      },
    });

    if (!vendor) {
      return NextResponse.json(
        {
          ok: false,
          error: "Vendor not found or access denied.",
        },
        {
          status: 404,
          headers: {
            "cache-control": "no-store",
          },
        },
      );
    }

    await prisma.$transaction(async (tx) => {
      if (isPrimary) {
        await clearPrimaryVendorContacts(
          tx,
          vendor.id,
        );
      }

      const existingRows = await findVendorContactByEmail(
        tx,
        vendor.id,
        email,
      );

      const existingId = existingRows[0]?.id ?? null;

      if (existingId) {
        await updateVendorContactRow(tx, {
          id: existingId,
          name,
          email,
          role,
          phone: phone || null,
          isPrimary,
        });
      } else {
        await insertVendorContactRow(tx, {
          vendorId: vendor.id,
          name,
          email,
          role,
          phone: phone || null,
          isPrimary,
        });
      }

      if (isPrimary) {
        await updateVendor({
          where: {
            id: vendor.id,
          },
          data: {
            contactName: name,
            contactEmail: email,
          },
        }, tx);
      }
    });

    const wantsJson =
      req.headers
        .get("content-type")
        ?.includes("application/json") ||
      req.headers
        .get("accept")
        ?.includes("application/json");

    if (wantsJson) {
      return NextResponse.json(
        {
          ok: true,
          vendorId: vendor.id,
          redirectTo: `/vendors/${vendor.id}`,
        },
        {
          headers: {
            "cache-control": "no-store",
          },
        },
      );
    }

    return NextResponse.redirect(
      new URL(`/vendors/${vendor.id}`, req.url),
      303,
    );
  } catch (error) {
    console.error(
      "POST /api/vendors/[id]/contacts failed:",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        error: "Unable to save vendor contact.",
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
