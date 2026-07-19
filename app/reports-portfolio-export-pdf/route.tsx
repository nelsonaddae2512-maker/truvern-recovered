// app/api/reports/portfolio/export/pdf/route.tsx
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireDbOrganization } from "@/lib/org-db";
import { headers } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function safeStr(v: unknown) {
  return typeof v === "string" ? v.trim() : "";
}

function num(v: unknown): number | null {
  const n = Number(String(v ?? "").trim());
  return Number.isFinite(n) && n > 0 ? n : null;
}

function bufferToArrayBuffer(buf: Buffer): ArrayBuffer {
  // ? Always returns a real ArrayBuffer (avoids SharedArrayBuffer typing issues)
  return Uint8Array.from(buf).buffer;
}

async function getRequestOrigin() {
  const h = await headers();
  const proto = safeStr(h.get("x-forwarded-proto")) || "http";
  const host =
    safeStr(h.get("x-forwarded-host")) ||
    safeStr(h.get("host")) ||
    "localhost:3000";
  return `${proto}://${host}`;
}

function esc(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function fmtDate(d: Date) {
  try {
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return d.toISOString();
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const vendorLimit = Math.min(num(url.searchParams.get("take")) ?? 50, 200);

  const org = await requireDbOrganization().catch(() => null);
  const orgId = Number((org as any)?.id);
  if (!Number.isFinite(orgId) || orgId <= 0) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const origin = await getRequestOrigin();

  // -----------------------------
  // Core portfolio data (safe)
  // -----------------------------
  const vendors = await prisma.vendor.findMany({
    where: { organizationId: orgId },
    orderBy: { id: "desc" },
    select: {
      id: true,
      name: true,
      slug: true,
      category: true,
      tier: true,
      criticality: true,
      
      riskSnapshots: {
        take: 1,
        orderBy: { id: "desc" },
        select: { score: true,     },
      },
      _count: {
        select: { issues: true, evidence: true, evidenceRequests: true, assessments: true },
      },
    },
    take: vendorLimit,
  });

  // -----------------------------
  // ? FIX: vendorRiskAlert may not exist in this schema
  // Avoid prisma.vendorRiskAlert (hard type error) and treat it as optional at runtime.
  // -----------------------------
  const prismaAny = prisma as any;
  const alerts: Array<{
    id?: number;
    vendorId?: number;
    title?: string | null;
    severity?: string | null;
    createdAt?: Date | string | null;
    resolvedAt?: Date | string | null;
    vendor?: { id: number; name: string } | null;
  }> = prismaAny?.vendorRiskAlert?.findMany
    ? await prismaAny.vendorRiskAlert.findMany({
        where: { organizationId: orgId, resolvedAt: null },
        include: { vendor: { select: { id: true, name: true } } },
        orderBy: { id: "desc" },
        take: 200,
      })
    : [];

  // -----------------------------
  // Render HTML ? PDF (Playwright)
  // -----------------------------
  const now = new Date();
  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Truvern Portfolio Report</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;
           margin: 0; padding: 24px; color: #e5e7eb; background: #070a12; }
    .card { border: 1px solid rgba(255,255,255,0.10); background: rgba(0,0,0,0.35);
            border-radius: 16px; padding: 16px; margin-bottom: 14px; }
    .title { font-size: 20px; font-weight: 700; margin: 0 0 6px; }
    .sub { font-size: 12px; color: rgba(255,255,255,0.6); }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th, td { padding: 10px 8px; border-bottom: 1px solid rgba(255,255,255,0.08); vertical-align: top; }
    th { text-align: left; font-size: 11px; color: rgba(255,255,255,0.55); letter-spacing: 0.08em; }
    td { font-size: 12px; color: rgba(255,255,255,0.85); }
    .pill { display: inline-block; padding: 4px 10px; border-radius: 999px;
            border: 1px solid rgba(255,255,255,0.12); background: rgba(255,255,255,0.06);
            font-size: 11px; color: rgba(255,255,255,0.75); }
    .ok { border-color: rgba(52,211,153,0.25); background: rgba(52,211,153,0.10); color: rgba(167,243,208,0.95); }
    .warn { border-color: rgba(251,191,36,0.25); background: rgba(251,191,36,0.10); color: rgba(253,230,138,0.95); }
    .bad { border-color: rgba(244,63,94,0.25); background: rgba(244,63,94,0.10); color: rgba(254,205,211,0.95); }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono; }
    .muted { color: rgba(255,255,255,0.55); }
    .row { display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
    .h1 { font-size: 28px; font-weight: 800; margin: 0; }
    .right { text-align: right; }
    .small { font-size: 11px; }
    @page { margin: 14mm; }
  </style>
</head>
<body>
  <div class="card">
    <div class="row">
      <div>
        <div class="h1">Portfolio Report</div>
        <div class="sub">Generated ${esc(fmtDate(now))}</div>
      </div>
      <div class="right">
        <div class="pill">${esc(String(vendors.length))} vendors</div>
        <div class="sub small">Origin: ${esc(origin)}</div>
      </div>
    </div>
  </div>

  ${
    alerts.length
      ? `<div class="card">
          <div class="title">Open Risk Alerts</div>
          <div class="sub">This section appears only if your schema includes VendorRiskAlert.</div>
          <table>
            <thead>
              <tr>
                <th style="width:40%">Alert</th>
                <th style="width:25%">Vendor</th>
                <th style="width:15%">Severity</th>
                <th style="width:20%">Created</th>
              </tr>
            </thead>
            <tbody>
              ${alerts
                .slice(0, 100)
                .map((a) => {
                  const sev = String(a.severity ?? "").toUpperCase();
                  const sevCls = sev === "HIGH" ? "bad" : sev === "MEDIUM" ? "warn" : "ok";
                  const created = a.createdAt ? new Date(String(a.createdAt)) : null;
                  return `<tr>
                    <td>${esc(String(a.title ?? "Alert"))}</td>
                    <td>${esc(String(a.vendor?.name ?? a.vendorId ?? "ï¿½"))}</td>
                    <td><span class="pill ${sevCls}">${esc(sev || "ï¿½")}</span></td>
                    <td class="muted">${esc(created ? fmtDate(created) : "ï¿½")}</td>
                  </tr>`;
                })
                .join("")}
            </tbody>
          </table>
        </div>`
      : ""
  }

  <div class="card">
    <div class="title">Vendors</div>
    <div class="sub">Latest sealed snapshot + evidence/issues rollups.</div>
    <table>
      <thead>
        <tr>
          <th style="width:32%">Vendor</th>
          <th style="width:14%">Category</th>
          <th style="width:12%">Tier</th>
          <th style="width:16%">Snapshot</th>
          <th style="width:26%">Counts</th>
        </tr>
      </thead>
      <tbody>
        ${vendors
          .map((v: any) => {
            const snap = v.riskSnapshots?.[0] ?? null;
            const score = typeof snap?.score === "number" ? snap.score : null;
            const sealed = !!(snap?.sealedAt && snap?.sealedHash);
            const badge = sealed ? `<span class="pill ok">Sealed</span>` : `<span class="pill warn">Not sealed</span>`;
            const when = snap?.sealedAt
              ? fmtDate(new Date(String(snap.sealedAt)))
              : fmtDate(new Date(String(v.updatedAt)));

            const scorePill =
              score === null
                ? `<span class="pill muted">Score ï¿½</span>`
                : score >= 80
                  ? `<span class="pill bad">Risk ${Math.round(score)}</span>`
                  : score >= 50
                    ? `<span class="pill warn">Risk ${Math.round(score)}</span>`
                    : `<span class="pill ok">Risk ${Math.round(score)}</span>`;

            return `<tr>
              <td>
                <div><strong>${esc(v.name)}</strong></div>
                <div class="sub mono">/vendors/${v.id}</div>
              </td>
              <td>${esc(v.category ?? "ï¿½")}</td>
              <td>${esc(String((v.tier as any) ?? v.criticality ?? "ï¿½"))}</td>
              <td>
                <div>${badge} ${scorePill}</div>
                <div class="sub">Updated ${esc(when)}</div>
              </td>
              <td class="muted">
                Evidence: ${esc(String(v._count.evidence))} ï¿½
                Requests: ${esc(String(v._count.evidenceRequests))} ï¿½
                Issues: ${esc(String(v._count.issues))} ï¿½
                Assessments: ${esc(String(v._count.assessments))}
              </td>
            </tr>`;
          })
          .join("")}
      </tbody>
    </table>
  </div>
</body>
</html>`;

  try {
    // Playwright is already in your stack for PDFs.
    const { chromium } = await import("playwright");

    const browser = await chromium.launch();
    const page = await browser.newPage();

    await page.setContent(html, { waitUntil: "load" });

    const pdfBuf = await page.pdf({
      format: "Letter",
      printBackground: true,
      margin: { top: "14mm", right: "14mm", bottom: "14mm", left: "14mm" },
    });

    await page.close();
    await browser.close();

    const body = bufferToArrayBuffer(pdfBuf);

    return new NextResponse(body, {
      status: 200,
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="truvern-portfolio-report.pdf"`,
        "cache-control": "no-store",
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      {
        ok: false,
        error: "PDF generation failed",
        detail: safeStr(e?.message) || String(e || ""),
      },
      { status: 500 }
    );
  }
}







