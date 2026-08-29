import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import prisma from "@/lib/prisma";
import { requireDbOrganization } from "@/lib/org-db";
import { findFirstVendor } from "@/lib/repositories/vendor-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type Params = {
  params:
    | Promise<{ id: string; contactId: string }>
    | { id: string; contactId: string };
};

function parseId(value: unknown) {
  const parsed = Number(String(value ?? "").trim());

  return Number.isFinite(parsed) && parsed > 0
    ? Math.floor(parsed)
    : null;
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

async function readScopedVendor(
  vendorId: number,
  organizationId: number,
) {
  return findFirstVendor({
    where: {
      id: vendorId,
      organizationId,
    },
    select: {
      id: true,
    },
  });
}

export async function PATCH(
  req: Request,
  { params }: Params,
) {
  const gate = await requireApiAuth();

  if (!gate.ok) {
    return gate.response;
  }

  try {
    const resolvedParams = await params;

    const vendorId =
      parseId(resolvedParams.id);

    const contactId =
      parseId(resolvedParams.contactId);

    if (!vendorId || !contactId) {
      return NextResponse.json(
        {
          ok: false,
          error: "Invalid vendor or contact id.",
        },
        {
          status: 400,
          headers: {
            "cache-control": "no-store",
          },
        },
      );
    }

    const payload =
      (await req.json().catch(() => ({}))) as {
        action?: unknown;
      };

    if (
      String(payload.action ?? "").trim() !==
      "set-primary"
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: "Unsupported contact action.",
        },
        {
          status: 400,
          headers: {
            "cache-control": "no-store",
          },
        },
      );
    }

    const vendor =
      await readScopedVendor(
        vendorId,
        gate.organizationId,
      );

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

    const result =
      await prisma.$transaction(
        async (tx) => {
          const contact =
            await tx.vendorContact.findFirst({
              where: {
                id: contactId,
                vendorId: vendor.id,
              },
              select: {
                id: true,
                name: true,
                title: true,
                email: true,
                isPrimary: true,
              },
            });

          if (!contact) {
            return {
              kind: "not-found" as const,
            };
          }

          if (!contact.isPrimary) {
            await tx.vendorContact.updateMany({
              where: {
                vendorId: vendor.id,
              },
              data: {
                isPrimary: false,
              },
            });

            await tx.vendorContact.update({
              where: {
                id: contact.id,
              },
              data: {
                isPrimary: true,
              },
            });
          }

          await tx.vendor.update({
            where: {
              id: vendor.id,
            },
            data: {
              contactName: contact.name || null,
              contactTitle: contact.title || null,
              contactEmail: contact.email,
            },
          });

          return {
            kind: "updated" as const,
          };
        },
      );

    if (result.kind === "not-found") {
      return NextResponse.json(
        {
          ok: false,
          error: "Contact not found.",
        },
        {
          status: 404,
          headers: {
            "cache-control": "no-store",
          },
        },
      );
    }

    return NextResponse.json(
      {
        ok: true,
        vendorId: vendor.id,
        contactId,
        isPrimary: true,
      },
      {
        headers: {
          "cache-control": "no-store",
        },
      },
    );
  } catch (error) {
    console.error(
      "PATCH /api/vendors/[id]/contacts/[contactId] failed:",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        error: "Unable to update vendor contact.",
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

export async function DELETE(
  _req: Request,
  { params }: Params,
) {
  const gate = await requireApiAuth();

  if (!gate.ok) {
    return gate.response;
  }

  try {
    const resolvedParams = await params;

    const vendorId =
      parseId(resolvedParams.id);

    const contactId =
      parseId(resolvedParams.contactId);

    if (!vendorId || !contactId) {
      return NextResponse.json(
        {
          ok: false,
          error: "Invalid vendor or contact id.",
        },
        {
          status: 400,
          headers: {
            "cache-control": "no-store",
          },
        },
      );
    }

    const vendor =
      await readScopedVendor(
        vendorId,
        gate.organizationId,
      );

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

    const result =
      await prisma.$transaction(
        async (tx) => {
          const contact =
            await tx.vendorContact.findFirst({
              where: {
                id: contactId,
                vendorId: vendor.id,
              },
              select: {
                id: true,
                isPrimary: true,
              },
            });

          if (!contact) {
            return {
              kind: "not-found" as const,
            };
          }

          if (contact.isPrimary) {
            return {
              kind: "primary" as const,
            };
          }

          await tx.vendorContact.delete({
            where: {
              id: contact.id,
            },
          });

          return {
            kind: "deleted" as const,
          };
        },
      );

    if (result.kind === "not-found") {
      return NextResponse.json(
        {
          ok: false,
          error: "Contact not found.",
        },
        {
          status: 404,
          headers: {
            "cache-control": "no-store",
          },
        },
      );
    }

    if (result.kind === "primary") {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Select another primary contact before deleting this contact.",
        },
        {
          status: 409,
          headers: {
            "cache-control": "no-store",
          },
        },
      );
    }

    return NextResponse.json(
      {
        ok: true,
        vendorId: vendor.id,
        contactId,
        deleted: true,
      },
      {
        headers: {
          "cache-control": "no-store",
        },
      },
    );
  } catch (error) {
    console.error(
      "DELETE /api/vendors/[id]/contacts/[contactId] failed:",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        error: "Unable to delete vendor contact.",
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