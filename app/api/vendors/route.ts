import { NextResponse } from "next/server";
import { requireDbOrganization } from "@/lib/org-db";
import { Prisma, VendorContactRole, VendorCriticality, VendorTier } from "@prisma/client";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clean(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function parseVendorTier(value: unknown): VendorTier {
  const cleaned = clean(value);

  if (cleaned === VendorTier.CRITICAL) return VendorTier.CRITICAL;
  if (cleaned === VendorTier.IMPORTANT) return VendorTier.IMPORTANT;
  if (cleaned === VendorTier.STANDARD) return VendorTier.STANDARD;

  return VendorTier.STANDARD;
}

function parseVendorCriticality(value: unknown): VendorCriticality {
  const cleaned = clean(value);

  if (cleaned === VendorCriticality.HIGH) return VendorCriticality.HIGH;
  if (cleaned === VendorCriticality.MEDIUM) return VendorCriticality.MEDIUM;
  if (cleaned === VendorCriticality.LOW) return VendorCriticality.LOW;

  return VendorCriticality.MEDIUM;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export async function POST(request: Request) {
  try {
    const org = await requireDbOrganization();

    if ("_needsOrgSelection" in org) {
      return NextResponse.json(
        { ok: false, error: "Select an organization first." },
        { status: 400 },
      );
    }

    const body = await request.json();
    const name = clean(body?.name);

    if (!name) {
      return NextResponse.json(
        { ok: false, error: "Vendor name is required." },
        { status: 400 },
      );
    }

    const summary = clean(body?.summary);
    const website = clean(body?.website);

    const primaryContactName =
      clean(body?.primaryContactName);

    const primaryContactTitle =
      clean(body?.primaryContactTitle);

    const primaryContactEmail =
      clean(body?.primaryContactEmail)?.toLowerCase() ?? null;

    const primaryContactPhone =
      clean(body?.primaryContactPhone);

    const dataAccess =
      Array.isArray(body?.dataAccess)
        ? body.dataAccess
            .map((value: unknown) => clean(value))
            .filter(
              (value: string | null): value is string =>
                Boolean(value),
            )
        : [];

    const sensitiveData =
      Array.isArray(body?.sensitiveData)
        ? body.sensitiveData
            .map((value: unknown) => clean(value))
            .filter(
              (value: string | null): value is string =>
                Boolean(value),
            )
        : [];

    const externalAccess =
      typeof body?.externalAccess === "boolean"
        ? body.externalAccess
        : null;

    const productionAccess =
      typeof body?.productionAccess === "boolean"
        ? body.productionAccess
        : null;

    const hasPrimaryContactInput =
      Boolean(
        primaryContactName ||
          primaryContactTitle ||
          primaryContactEmail ||
          primaryContactPhone,
      );

    if (
      hasPrimaryContactInput &&
      (!primaryContactName || !primaryContactEmail)
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Primary contact name and email must be provided together.",
        },
        { status: 400 },
      );
    }

    const vendor =
      await prisma.$transaction(async (tx) => {
        const createdVendor =
          await tx.vendor.create({
            data: {
              name,
              organizationId: org.id,
              category: clean(body?.category),
              slug: `${slugify(name)}-${Date.now()}`,
              tier: parseVendorTier(body?.tier),
              criticality:
                parseVendorCriticality(body?.criticality),
              summary,
              website,
              dataAccess:
                dataAccess as Prisma.InputJsonValue,
              sensitiveData:
                sensitiveData as Prisma.InputJsonValue,
              externalAccess,
              productionAccess,
              contactName: primaryContactName,
              contactTitle: primaryContactTitle,
              contactEmail: primaryContactEmail,
            },
            select: {
              id: true,
              name: true,
            },
          });

        if (
          primaryContactName &&
          primaryContactEmail
        ) {
          await tx.vendorContact.create({
            data: {
              vendorId: createdVendor.id,
              name: primaryContactName,
              title: primaryContactTitle,
              email: primaryContactEmail,
              phone: primaryContactPhone,
              role: VendorContactRole.PRIMARY,
              isPrimary: true,
            },
          });
        }

        return createdVendor;
      });

    return NextResponse.json({
      ok: true,
      vendor,
    });
  } catch (error) {
    console.error("POST /api/vendors failed", error);

    return NextResponse.json(
      { ok: false, error: "Failed to create vendor." },
      { status: 500 },
    );
  }
}
