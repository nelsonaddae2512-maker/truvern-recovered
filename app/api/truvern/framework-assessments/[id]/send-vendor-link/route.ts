import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { requireReviewerAccess } from "@/lib/auth/truvern-governance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

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
  await requireReviewerAccess();

  const resolved = await params;
  const assessmentId = parseId(resolved.id);

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

  const assessment = await prisma.truvernFrameworkAssessment.findUnique({
    where: { id: assessmentId },
  });

  if (!assessment) {
    return NextResponse.json(
      { ok: false, error: "Framework assessment not found." },
      { status: 404 },
    );
  }

  const vendor = assessment.vendorId
    ? await prisma.vendor.findUnique({
        where: { id: assessment.vendorId },
        select: { name: true },
      })
    : null;

  const framework = await prisma.truvernFramework.findUnique({
    where: { id: assessment.frameworkId },
    select: {
      name: true,
      version: true,
    },
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const vendorUrl = `${appUrl}/vendor-assessments/${assessment.id}`;

  const subject = `Vendor governance assessment request - ${assessment.title}`;

  const html = `
    <div style="font-family:Inter,Arial,sans-serif;line-height:1.6;color:#111827">
      <h2>Vendor governance assessment request</h2>

      <p>
        Truvern has requested completion of a governance assessment for
        vendor review.
      </p>

      <table cellpadding="8" cellspacing="0" border="0">
        <tr>
          <td><strong>Assessment</strong></td>
          <td>${assessment.title}</td>
        </tr>

        <tr>
          <td><strong>Vendor</strong></td>
          <td>${vendor?.name || "Vendor"}</td>
        </tr>

        <tr>
          <td><strong>Framework</strong></td>
          <td>${framework?.name || "Governance framework"} ${framework?.version || ""}</td>
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

      <p style="margin-top:24px;font-size:13px;color:#6b7280">
        Truvern governance reviews are operational assessments and are not
        certifications, legal guarantees, or regulatory warranties.
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
    vendorUrl,
    assessmentId: assessment.id,
  });
}
