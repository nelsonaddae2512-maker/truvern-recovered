import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireDbOrganization } from "@/lib/org-db";
import { VendorCriticality, VendorTier } from "@prisma/client";

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

    const vendor = await prisma.vendor.create({
      data: {
        name,
        organizationId: org.id,
        category: clean(body?.category),
        slug: `${slugify(name)}-${Date.now()}`,
        tier: parseVendorTier(body?.tier),
        criticality: parseVendorCriticality(body?.criticality),
      },
      select: {
        id: true,
        name: true,
      },
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
