import { NextResponse } from "next/server";
import { governanceAuthErrorResponse } from "@/lib/auth/governance-auth-errors";
import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";
import prisma from "@/lib/prisma";
import { requireReleasePacketAccess } from "@/lib/auth/truvern-governance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteContext = {
  params: Promise<{ id: string }>;
};

function parseId(value: unknown) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function safeFilename(value: string) {
  return value
    .trim()
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 120);
}

export async function GET(request: Request, context: RouteContext) {
  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null;

  try {
    const { id: rawId } = await context.params;
    const assessmentId = parseId(rawId);

    if (!assessmentId) {
      return NextResponse.json({ ok: false, error: "Invalid assessment id." }, { status: 400 });
    }

    await requireReleasePacketAccess(assessmentId);

    const assessment = await prisma.truvernFrameworkAssessment.findUnique({
      where: { id: assessmentId },
      select: {
        id: true,
        title: true,
        status: true,
        metadata: true,
      },
    });

    if (!assessment) {
      return NextResponse.json({ ok: false, error: "Assessment not found." }, { status: 404 });
    }

    const metadata =
      assessment.metadata && typeof assessment.metadata === "object"
        ? (assessment.metadata as any)
        : {};

    if (!metadata.governanceSeal || !metadata.governanceReleaseSnapshot) {
      return NextResponse.json(
        {
          ok: false,
          error: "Assessment must be confirmed and sealed before PDF export.",
        },
        { status: 409 },
      );
    }

    const origin = new URL(request.url).origin;
    const packetUrl = `${origin}/api/truvern/framework-assessments/${assessmentId}/packet`;

    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: { width: 1280, height: 720 },
      executablePath: await chromium.executablePath(),
      headless: true,
    });

    const page = await browser.newPage();
    await page.goto(packetUrl, {
      waitUntil: "networkidle0",
      timeout: 60_000,
    });

    const pdf = await page.pdf({
      format: "Letter",
      printBackground: true,
      margin: {
        top: "0.45in",
        right: "0.45in",
        bottom: "0.45in",
        left: "0.45in",
      },
      displayHeaderFooter: true,
      headerTemplate: `
        <div style="font-size:8px;color:#64748b;width:100%;padding:0 36px;">
          Truvern Framework Assessment Packet
        </div>
      `,
      footerTemplate: `
        <div style="font-size:8px;color:#64748b;width:100%;padding:0 36px;display:flex;justify-content:space-between;">
          <span>Immutable governance release</span>
          <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
        </div>
      `,
    });

    await browser.close();
    browser = null;

    const filename = `${safeFilename(assessment.title || `framework-assessment-${assessment.id}`)}.pdf`;

    return new NextResponse(Buffer.from(pdf), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `inline; filename="${filename}"`,
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    if (browser) {
      await browser.close().catch(() => undefined);
    }

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate framework assessment PDF.",
      },
      { status: 500 },
    );
  }
}





