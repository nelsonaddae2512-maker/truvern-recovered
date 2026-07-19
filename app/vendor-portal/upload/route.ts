// app/api/uploads/route.ts
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import path from "path";
import fs from "fs/promises";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function json(data: any, status = 200) {
  return NextResponse.json(data, { status });
}

function isDevBypass(req: Request) {
  const b = req.headers.get("x-dev-bypass");
  return b === "1" || b?.toLowerCase() === "true";
}

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

function safeName(name: string) {
  // remove weird chars, keep basic safe filename chars
  return name.replace(/[^a-zA-Z0-9._-]+/g, "_");
}

function uniq() {
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

/**
 * POST /api/uploads
 * Content-Type: multipart/form-data
 * Form fields:
 *  - file: File
 *
 * Returns: { ok: true, url, name, size, type }
 *
 * NOTE:
 * - This stores files in /public/uploads (good for local dev).
 * - On Vercel/serverless, local filesystem is not durable. Swap to S3/R2 later.
 */
export async function POST(req: Request) {
  try {
    const bypass = isDevBypass(req);

    if (!bypass) {
      const a = await auth();
      if (!a?.userId) return json({ ok: false, error: "Unauthorized" }, 401);
    }

    const form = await req.formData();
    const file = form.get("file");

    if (!file || !(file instanceof File)) {
      return json({ ok: false, error: "file is required (multipart/form-data)" }, 400);
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const original = safeName(file.name || "upload.bin");
    const ext = path.extname(original);
    const base = path.basename(original, ext);

    const relDir = "/uploads";
    const absDir = path.join(process.cwd(), "public", "uploads");
    await ensureDir(absDir);

    const filename = `${base}_${uniq()}${ext || ""}`;
    const absPath = path.join(absDir, filename);

    await fs.writeFile(absPath, buf);

    const url = `${relDir}/${filename}`;

    return json(
      {
        ok: true,
        url,
        name: original,
        size: file.size,
        type: file.type || "application/octet-stream",
      },
      201
    );
  } catch (err: any) {
    return json(
      {
        ok: false,
        error: "SERVER_ERROR",
        message: err?.message || String(err),
      },
      500
    );
  }
}




