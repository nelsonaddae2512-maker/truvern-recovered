// app/api/og-image/[id]/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function safeStr(v: unknown) {
  return typeof v === "string" ? v.trim() : "";
}

function parseNumericId(raw: unknown): number | null {
  const m = String(raw ?? "").match(/\d+/);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

function toBufferMaybe(v: unknown): Buffer | null {
  if (!v) return null;

  if (typeof Buffer !== "undefined" && Buffer.isBuffer(v)) return v as Buffer;

  if (typeof v === "string") {
    const s = v.trim();

    if (s.startsWith("data:") && s.includes("base64,")) {
      const b64 = s.split("base64,")[1] || "";
      try {
        return Buffer.from(b64, "base64");
      } catch {
        return null;
      }
    }

    if (s.length > 100 && /^[A-Za-z0-9+/=\s]+$/.test(s)) {
      try {
        return Buffer.from(s.replace(/\s+/g, ""), "base64");
      } catch {
        return null;
      }
    }
  }

  if (v instanceof Uint8Array) {
    try {
      return Buffer.from(v);
    } catch {
      return null;
    }
  }

  return null;
}

function bufferToBody(buf: Buffer): ArrayBuffer {
  // œ… TS-safe: guarantee a real ArrayBuffer (not SharedArrayBuffer) by copying
  const u8 = new Uint8Array(buf.byteLength);
  u8.set(buf);
  return u8.buffer;
}

function guessContentType(v: any): string {
  const ct =
    safeStr(v?.contentType) ||
    safeStr(v?.mimeType) ||
    safeStr(v?.mime) ||
    safeStr(v?.type);

  if (ct) return ct;
  return "image/png";
}

async function fetchBytesFromUrl(url: string): Promise<{ buf: Buffer; contentType: string } | null> {
  const u = safeStr(url);
  if (!u) return null;

  try {
    const res = await fetch(u, { cache: "no-store" });
    if (!res.ok) return null;

    const ab = await res.arrayBuffer();
    const buf = Buffer.from(ab);

    const ct = safeStr(res.headers.get("content-type")) || "image/png";
    return { buf, contentType: ct };
  } catch {
    return null;
  }
}

export async function GET(req: Request, ctx: { params: { id: string } }) {
  const ogId = parseNumericId(ctx?.params?.id);
  if (!ogId) return json({ ok: false, error: "INVALID_ID" }, 400);

  const url = new URL(req.url);
  const debug = url.searchParams.get("debug") === "1";

  // œ… Schema-resilient: avoid prisma.ogImage type error
  const ogModel: any =
    (prisma as any).ogImage ||
    (prisma as any).OgImage ||
    (prisma as any).oGImage ||
    null;

  if (!ogModel?.findUnique) {
    return debug
      ? json({ ok: false, error: "MODEL_MISSING", modelTried: ["ogImage", "OgImage", "oGImage"] }, 404)
      : new NextResponse("Not found", { status: 404 });
  }

  const og = await ogModel.findUnique({
    where: { id: ogId },
  });

  if (!og) {
    return debug ? json({ ok: false, error: "NOT_FOUND" }, 404) : new NextResponse("Not found", { status: 404 });
  }

  const buf =
    toBufferMaybe((og as any).bytes) ||
    toBufferMaybe((og as any).imageBytes) ||
    toBufferMaybe((og as any).data) ||
    toBufferMaybe((og as any).blob) ||
    toBufferMaybe((og as any).pngBytes) ||
    toBufferMaybe((og as any).jpegBytes) ||
    null;

  const contentType = guessContentType(og);

  if (!buf) {
    const urlField =
      safeStr((og as any).url) ||
      safeStr((og as any).imageUrl) ||
      safeStr((og as any).fileUrl) ||
      safeStr((og as any).src) ||
      safeStr((og as any).publicUrl);

    if (urlField) {
      const fetched = await fetchBytesFromUrl(urlField);
      if (fetched) {
        if (debug) {
          return json({
            ok: true,
            mode: "fetched",
            id: ogId,
            contentType: fetched.contentType,
            size: fetched.buf.length,
            url: urlField,
          });
        }

        return new NextResponse(bufferToBody(fetched.buf), {
          status: 200,
          headers: {
            "content-type": fetched.contentType,
            "cache-control": "public, max-age=0, must-revalidate",
          },
        });
      }
    }

    return debug
      ? json(
          {
            ok: false,
            error: "NO_BYTES",
            hint: "Model exists but no recognized bytes/url columns were found.",
            keys: Object.keys(og || {}),
          },
          404
        )
      : new NextResponse("Not found", { status: 404 });
  }

  if (debug) {
    return json({
      ok: true,
      mode: "bytes",
      id: ogId,
      contentType,
      size: buf.length,
      keys: Object.keys(og || {}),
    });
  }

  return new NextResponse(bufferToBody(buf), {
    status: 200,
    headers: {
      "content-type": contentType,
      "cache-control": "public, max-age=0, must-revalidate",
    },
  });
}





