import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireDbOrganization } from "@/lib/org-db";
import { sendEmail } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
async function requireApiAuth() {
  const { userId } = await auth();

  if (!userId) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401, headers: { "cache-control": "no-store" } },
      ),
    };
  }

  try {
    const org = await requireDbOrganization();

    return {
      ok: true as const,
      userId,
      org,
    };
  } catch {
    return {
      ok: false as const,
      response: NextResponse.json(
        { ok: false, error: "Organization required" },
        { status: 403, headers: { "cache-control": "no-store" } },
      ),
    };
  }
}

type Params = {
  params: Promise<{ id: string }> | { id: string };
};

function parseId(value: unknown) {
  const n = Number(String(value ?? "").trim());
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

function normalizeEmails(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value
    .map((v) => String(v || "").trim().toLowerCase())
    .filter(Boolean);
}

export async function POST(req: Request, { params }: Params) {
  const gate = await requireApiAuth();

  if (!gate.ok) {
    return gate.response;
  }

try {
    const resolvedParams = await params;
    const assessmentId = parseId(resolvedParams.id);

    if (!assessmentId) {
      return NextResponse.json(
        { ok: false, error: "Invalid assessment id." },
        { status: 400 },
      );
    }

    const body = await req.json().catch(() => ({}));
    const recipients = normalizeEmails(body.recipients);

    if (!recipients.length) {
      return NextResponse.json(
        { ok: false, error: "At least one recipient is required." },
        { status: 400 },
      );
    }

    const assessment = await prisma.assessment.findUnique({
      where: { id: assessmentId },
      select: {
        id: true,
        title: true,
        token: true,
        dueAt: true,
        vendor: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!assessment) {
      return NextResponse.json(
        { ok: false, error: "Assessment not found." },
        { status: 404 },
      );
    }

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      "http://localhost:3000";

    const vendorUrl =
      `${appUrl}/vendor-assessment/${assessment.token}`;

    const dueDate = assessment.dueAt
      ? new Intl.DateTimeFormat("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        }).format(assessment.dueAt)
      : "No due date";

    const subject =
      `Vendor review request Ã¢‚¬€ ${assessment.title}`;

    const html = `
      <div style="font-family:Inter,Arial,sans-serif;line-height:1.6;color:#111827">
        <h2>Vendor review request</h2>

        <p>
          Truvern has requested completion of the following assessment.
        </p>

        <table cellpadding="8" cellspacing="0" border="0">
          <tr>
            <td><strong>Assessment</strong></td>
            <td>${assessment.title}</td>
          </tr>

          <tr>
            <td><strong>Vendor</strong></td>
            <td>${assessment.vendor?.name || "Vendor"}</td>
          </tr>

          <tr>
            <td><strong>Due date</strong></td>
            <td>${dueDate}</td>
          </tr>
        </table>

        <p style="margin-top:24px">
          <a
            href="${vendorUrl}"
            style="
              background:#06b6d4;
              color:white;
              padding:12px 18px;
              text-decoration:none;
              border-radius:10px;
              display:inline-block;
              font-weight:600;
            "
          >
            Open assessment
          </a>
        </p>

        <p style="margin-top:24px;font-size:14px;color:#6b7280">
          Secure assessment link:
          <br />
          ${vendorUrl}
        </p>
      </div>
    `;

    const result = await sendEmail({
      to: recipients.join(", "),
      subject,
      html,
    });

    return NextResponse.json({
      ok: true,
      provider: result.provider,
      recipients,
    });
  } catch (error: any) {
    console.error(error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error?.message ||
          "Failed to send vendor review email.",
      },
      { status: 500 },
    );
  }
}





