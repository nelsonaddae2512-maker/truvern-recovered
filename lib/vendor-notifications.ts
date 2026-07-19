// lib/vendor-notifications.ts
import prisma from "@/lib/prisma";
import { sendEmail } from "@/lib/email";

function safe(s: any) {
  return typeof s === "string" ? s : s == null ? "" : String(s);
}

function looksLikeEmail(v: any) {
  return typeof v === "string" && v.includes("@") && v.trim().length >= 5;
}

export function pickVendorEmail(vendor: any, emailFieldOverride?: string | null): string | null {
  if (!vendor) return null;

  // Explicit override: read vendor[emailFieldOverride]
  if (emailFieldOverride && typeof emailFieldOverride === "string") {
    const raw = (vendor as any)[emailFieldOverride];
    if (looksLikeEmail(raw)) return String(raw).trim();
  }

  // Common candidates
  const candidates = [
    (vendor as any).contactEmail,
    (vendor as any).primaryEmail,
    (vendor as any).email,
    (vendor as any).securityEmail,
    (vendor as any).supportEmail,
    (vendor as any).complianceEmail,
    (vendor as any).vendorEmail,
  ];

  for (const c of candidates) {
    if (looksLikeEmail(c)) return String(c).trim();
  }

  // Heuristic: any field that contains "email" and looks like an email
  for (const [k, v] of Object.entries(vendor)) {
    if (k.toLowerCase().includes("email") && looksLikeEmail(v)) return String(v).trim();
  }

  return null;
}

export function listEmailLikeKeys(vendor: any): string[] {
  if (!vendor) return [];
  const keys: string[] = [];
  for (const [k, v] of Object.entries(vendor)) {
    if (k.toLowerCase().includes("email") && looksLikeEmail(v)) keys.push(k);
  }
  return keys;
}

/**
 * Schema-tolerant vendor notification sender.
 * Does NOT assume Vendor.contactEmail exists.
 */
export async function notifyVendorEvidenceStatusChange(args: {
  evidenceRequestId: number;
  subject: string;
  headline: string;
  message: string; // HTML allowed
  emailFieldOverride?: string | null; // optional: vendor field name to use for email
}) {
  const req = await prisma.evidenceRequest.findUnique({
    where: { id: args.evidenceRequestId },
    select: {
      id: true,
      status: true,
      dueAt: true,
      label: true,
      vendorId: true,
      organizationId: true,
    } as any,
  });

  if (!req) return { ok: false as const, skipped: true as const, reason: "EvidenceRequest not found" };

  // Fetch vendor WITHOUT select so we don't reference non-existent fields
  const vendor = await prisma.vendor.findUnique({
    where: { id: (req as any).vendorId },
  } as any);

  const vendorEmail = pickVendorEmail(vendor, args.emailFieldOverride || null);
  if (!vendorEmail) {
    return {
      ok: false as const,
      skipped: true as const,
      reason: "No vendor email field found",
      vendorId: (req as any).vendorId,
      emailLikeKeys: listEmailLikeKeys(vendor),
      vendorKeys: vendor ? Object.keys(vendor).slice(0, 60) : [],
    };
  }

  let orgName = "Your customer";
  const orgId = (req as any).organizationId;
  if (orgId != null) {
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { name: true } as any,
    });
    if (org?.name) orgName = String((org as any).name ?? "");
  }

  const vendorName = safe((vendor as any)?.name || "Vendor");
  const label = safe((req as any).label || `Evidence Request #${(req as any).id}`);
  const dueLine = (req as any).dueAt ? `Due: ${new Date((req as any).dueAt).toLocaleString()}` : "No due date set";

  const html = `
  <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto; line-height:1.5">
    <h2 style="margin:0 0 8px 0">${args.headline}</h2>
    <p style="margin:0 0 10px 0; color:#555">${safe(orgName)} €¢ ${vendorName}</p>

    <div style="padding:12px 14px; border:1px solid #eee; border-radius:12px; background:#fafafa">
      <div><b>${label}</b></div>
      <div>Status: <b>${safe((req as any).status)}</b></div>
      <div>${dueLine}</div>
    </div>

    <p style="margin:12px 0 0 0">${args.message}</p>

    <p style="margin:12px 0 0 0; color:#777; font-size:12px">
      Sent by Truvern on behalf of ${safe(orgName)}.
    </p>
  </div>`;

  await sendEmail({
    to: vendorEmail,
    subject: args.subject,
    html,
  });

  return { ok: true as const, to: vendorEmail };
}

export function isOpenStatus(status: string) {
  const s = (status || "").toUpperCase();
  return !["APPROVED", "REJECTED", "CANCELLED", "FULFILLED", "COMPLETED"].includes(s);
}






