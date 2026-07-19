// lib/auth/resolveVendorContext.ts
import { auth, currentUser } from "@clerk/nextjs/server";

export type VendorContext =
  | { kind: "bypass"; vendorId: number }
  | { kind: "vendor"; vendorId: number; userId: string }
  | { kind: "internal"; userId: string }
  | null;

export async function resolveVendorContext(): Promise<VendorContext> {
  // Dev bypass (ONLY non-production)
  if (
    process.env.NODE_ENV !== "production" &&
    process.env.TRUVERN_DEV_BYPASS_AUTH === "1"
  ) {
    const v = Number(process.env.TRUVERN_DEV_VENDOR_ID ?? "");
    if (Number.isFinite(v)) return { kind: "bypass", vendorId: v };
  }

  const { userId } = await auth();
  if (!userId) return null;

  const user = await currentUser();
  const pm: any = user?.publicMetadata ?? {};

  // Treat these as "internal" users allowed to manage assessments
  const role = String(pm.role ?? pm.orgRole ?? "").toUpperCase();
  const isInternal = pm.isInternal === true || ["ADMIN", "ANALYST", "OWNER"].includes(role);
  if (isInternal) return { kind: "internal", userId };

  // Vendor user (must have vendorId)
  const vendorIdRaw = pm.vendorId;
  const vendorId =
    typeof vendorIdRaw === "number"
      ? vendorIdRaw
      : typeof vendorIdRaw === "string"
      ? Number(vendorIdRaw)
      : NaN;

  if (!Number.isFinite(vendorId)) return null;

  return { kind: "vendor", vendorId, userId };
}




