// lib/actor.ts
import { NextRequest } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { requireDbOrganization } from "@/lib/org-db";

export type Actor =
  | { mode: "org"; orgId: number }
  | { mode: "vendor"; vendorId: number };

function toInt(v: string | null): number | null {
  if (!v) return null;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

function isDev() {
  return process.env.NODE_ENV !== "production";
}

function devBypassEnabled() {
  return isDev() && process.env.TRUVERN_DEV_BYPASS_AUTH === "1";
}

type ResolveActorOptions = {
  /**
   * If true, this endpoint supports vendor actors even if the URL path
   * is not under /vendor-portal. (Useful for shared APIs like /api/evidence/*)
   */
  allowVendorActor?: boolean;

  /**
   * If true, allows dev query overrides:
   *  - ?devOrgId=1
   *  - ?devVendorId=1
   * Only active in non-production.
   */
  allowDevQueryOverride?: boolean;
};

async function resolveVendorIdFromClerk(): Promise<number | null> {
  try {
    const user = await currentUser();
    const vendorIdRaw = (user?.publicMetadata as any)?.vendorId;

    const vendorId =
      typeof vendorIdRaw === "number"
        ? vendorIdRaw
        : typeof vendorIdRaw === "string"
        ? Number(vendorIdRaw)
        : NaN;

    return Number.isFinite(vendorId) && Number(vendorId) > 0
      ? Number(vendorId)
      : null;
  } catch (e) {
    if (isDev()) console.error("resolveActor: currentUser() failed", e);
    return null;
  }
}

export async function resolveActor(
  req: NextRequest,
  opts: ResolveActorOptions = {}
): Promise<Actor | null> {
  const allowVendorActor = opts.allowVendorActor === true;
  const allowDevQueryOverride = opts.allowDevQueryOverride === true;

  const url = new URL(req.url);
  const pathname = url.pathname;

  // DEV-ONLY query overrides (do NOT rely on process env)
  if (isDev() && allowDevQueryOverride) {
    const devOrgId = toInt(url.searchParams.get("devOrgId"));
    if (devOrgId && devOrgId > 0) return { mode: "org", orgId: devOrgId };

    const devVendorId = toInt(url.searchParams.get("devVendorId"));
    if (devVendorId && devVendorId > 0)
      return { mode: "vendor", vendorId: devVendorId };
  }

  // DEV bypass (process env driven)
  if (devBypassEnabled()) {
    const envOrgId = toInt(process.env.TRUVERN_DEV_ORG_ID ?? "");
    const envVendorId = toInt(process.env.TRUVERN_DEV_VENDOR_ID ?? "");

    // Prefer org for non-vendor routes; allow vendor only when explicitly needed.
    if (envOrgId && envOrgId > 0) return { mode: "org", orgId: envOrgId };
    if (allowVendorActor && envVendorId && envVendorId > 0) {
      return { mode: "vendor", vendorId: envVendorId };
    }
    // If they only set vendor id but this route isn't vendor-capable, don't return vendor here.
    return envOrgId && envOrgId > 0 ? { mode: "org", orgId: envOrgId } : null;
  }

  // Normal auth
  const { userId } = await auth();
  if (!userId) return null;

  // Default policy:
  // - Vendor actor is only assumed on vendor-portal routes
  // - OR for endpoints that explicitly allow vendor actors (allowVendorActor=true)
  const vendorPortalPath =
    pathname.startsWith("/vendor-portal") || pathname.startsWith("/api/vendor-portal");

  if (allowVendorActor || vendorPortalPath) {
    const vendorId = await resolveVendorIdFromClerk();
    if (vendorId) return { mode: "vendor", vendorId };
  }

  // Org actor (DB)
  const org = await requireDbOrganization();
  return { mode: "org", orgId: "id" in org ? org.id : 0 };
}






