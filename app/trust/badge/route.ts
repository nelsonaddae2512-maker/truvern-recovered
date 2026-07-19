import prisma from "@/lib/db";

export const runtime = "nodejs"
export const dynamic = "force-dynamic";
import type { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

async function requireUserId() {
  const { userId } = await auth();
  if (!userId) {
    return { ok: false as const, res: NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 }) };
  }
  return { ok: true as const, userId };
}

type AnswerLite = { evidenceStatus?: "approved"|"pending"|"rejected"|string|null };

function svgBadge(label: string, value: string, color = "#10b981") {
  const w = 140, h = 24, pad = 8, font = 12;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${label}: ${value}">
  <title>${label}: ${value}</title>
  <rect rx="4" width="${w}" height="${h}" fill="#111827"/>
  <rect x="${w/2}" width="${w/2}" height="${h}" fill="${color}" opacity="0.15"/>
  <text x="${pad}" y="16" fill="#e5e7eb" font-family="ui-sans-serif,system-ui,Segoe UI,Roboto,Helvetica,Arial" font-size="${font}">${label}</text>
  <text x="${w/2 + pad}" y="16" fill="${color}" font-weight="700" font-family="ui-sans-serif,system-ui,Segoe UI,Roboto,Helvetica,Arial" font-size="${font}">${value}</text>
</svg>`;
}

export async function GET(req: NextRequest){ 
  const g = await requireUserId();
  if (!g.ok) return g.res;
const { prisma } = await import("@/lib/prisma"); 
  try {
    const slug = (new URL(req.url).searchParams.get("slug") || "").trim().toLowerCase();
    if (!slug) {
      const svg = svgBadge("Trust", "Ãƒ¢Ã¢€š¬Ã¢‚¬", "#6b7280");
      return new Response(svg, { status: 200, headers: { "Content-Type": "image/svg+xml", "Cache-Control": "no-store" } });
    }

    let prisma: any = null;
    try { prisma = (await import("@/lib/prisma"))?.prisma ?? null; } catch {}

    if (!prisma) {
      const svg = svgBadge("Trust", "N/A", "#f59e0b");
      return new Response(svg, { status: 200, headers: { "Content-Type": "image/svg+xml", "Cache-Control": "no-store" } });
    }

    const vendor = await prisma.vendor.findFirst({ where: { slug }, select: { id: true, trustScore: true, trustLevel: true } });
    if (!vendor) {
      const svg = svgBadge("Trust", "Unknown", "#9ca3af");
      return new Response(svg, { status: 200, headers: { "Content-Type": "image/svg+xml", "Cache-Control": "no-store" } });
    }

    let score = typeof vendor.trustScore === "number" ? vendor.trustScore : 0;
    let level = typeof vendor.trustLevel === "string" ? vendor.trustLevel : "Low";

    if (vendor.trustScore == null || !vendor.trustLevel) {
      const answers: AnswerLite[] = await prisma.answer.findMany({ where: { vendorId: vendor.id }, select: { evidenceStatus: true } });
      const total = answers.length;
      const approved = answers.filter((a: AnswerLite) => a.evidenceStatus === "approved").length;
      score = total > 0 ? Math.round((approved / total) * 100) : 0;
      level = score >= 80 ? "High" : score >= 50 ? "Medium" : "Low";
    }

    const color = level === "High" ? "#10b981" : level === "Medium" ? "#f59e0b" : "#ef4444";
    const svg = svgBadge("Trust", `${level} (${score}%)`, color);
    return new Response(svg, { status: 200, headers: { "Content-Type": "image/svg+xml", "Cache-Control": "no-store" } });
  } catch {
    const svg = svgBadge("Trust", "Error", "#ef4444");
    return new Response(svg, { status: 200, headers: { "Content-Type": "image/svg+xml", "Cache-Control": "no-store" } });
  }
}






