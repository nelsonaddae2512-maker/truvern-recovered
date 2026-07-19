import Link from "next/link";
import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import SendVendorAssessmentLink from "@/components/assessments/send-vendor-assessment-link.client";
import CopyVendorAssessmentLinkButton from "@/components/assessments/copy-vendor-assessment-link-button.client";
import AssessmentPortalControls from "@/components/assessments/assessment-portal-controls.client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = {
  params: Promise<{ id: string }> | { id: string };
};

function parseId(value: unknown) {
  const n = Number(String(value ?? "").trim());
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

export default async function AssessmentLaunchPage({ params }: Props) {
  const resolvedParams = await params;
  const assessmentId = parseId(resolvedParams.id);

  if (!assessmentId) return notFound();

  const assessment = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    select: {
      id: true,
      title: true,
      status: true,
      token: true,
      dueAt: true,
      vendorEmail: true,
      vendorContactName: true,
      vendor: {
        select: {
          id: true,
          name: true,
          contactEmail: true,
          contactName: true,
          contacts: {
            orderBy: [{ isPrimary: "desc" }, { id: "asc" }],
            select: {
              id: true,
              name: true,
              email: true,
              isPrimary: true,
            },
          },
        },
      },
      template: {
        select: {
          name: true,
        },
      },
    },
  });

  if (!assessment) return notFound();

  const vendorUrl = assessment.token ? `/vendor-assessment/${assessment.token}` : null;

  const contactMap = new Map<string, { id: string; label: string; email: string }>();

  if (assessment.vendor.contactEmail) {
    contactMap.set(assessment.vendor.contactEmail.toLowerCase(), {
      id: "legacy-contact",
      label: assessment.vendor.contactName || "Primary vendor contact",
      email: assessment.vendor.contactEmail,
    });
  }

  for (const contact of assessment.vendor.contacts) {
    contactMap.set(contact.email.toLowerCase(), {
      id: String(contact.id),
      label: `${contact.name || "Vendor contact"}${contact.isPrimary ? " · Primary" : ""}`,
      email: contact.email,
    });
  }

  const contactOptions = Array.from(contactMap.values());

  return (
    <main className="mx-auto max-w-7xl px-6 py-12 text-white">
      <section className="grid gap-10 lg:grid-cols-[1fr_0.85fr] lg:items-start">
        <div>
          <div className="inline-flex rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm text-cyan-200">
            Assessment launched
          </div>

          <h1 className="mt-6 max-w-5xl text-5xl font-semibold tracking-tight">
            Vendor review is ready to send.
          </h1>

          <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-300">
            Truvern created a live assessment instance, generated a secure vendor
            completion token, and prepared the submission workflow for Governance Ops intake.
          </p>

          <div className="mt-10 flex flex-wrap gap-4">
            {vendorUrl ? (
              <Link href={vendorUrl} className="rounded-full bg-cyan-300 px-7 py-4 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200">
                Open vendor link
              </Link>
            ) : null}

            <Link href={`/vendors/${assessment.vendor.id}`} className="rounded-full border border-white/15 px-7 py-4 text-sm font-semibold text-white transition hover:bg-white/10">
              Back to vendor
            </Link>

            <Link href="/review-desk" className="rounded-full border border-white/15 px-7 py-4 text-sm font-semibold text-white transition hover:bg-white/10">
              Governance Ops
            </Link>
          </div>
        </div>

        <aside className="rounded-[2rem] border border-cyan-400/20 bg-white/[0.04] p-7 shadow-2xl shadow-cyan-950/20">
          <p className="text-xs uppercase tracking-[0.3em] text-cyan-200">Launch summary</p>

          <div className="mt-6 space-y-4">
            <SummaryRow label="Assessment" value={assessment.title || `Assessment #${assessment.id}`} />
            <SummaryRow label="Vendor" value={assessment.vendor.name} />
            <SummaryRow label="Template" value={assessment.template?.name || "Template"} />
            <SummaryRow label="Status" value={String(assessment.status)} />
            <SummaryRow label="Due date" value={assessment.dueAt ? assessment.dueAt.toLocaleDateString() : "Not set"} />
            <SummaryRow label="Vendor email" value={assessment.vendorEmail || assessment.vendor.contactEmail || "Not set"} />
          </div>
        </aside>
      </section>

      <SendVendorAssessmentLink assessmentId={assessment.id} defaultContacts={contactOptions} />


        <section className="mt-8 rounded-[2rem] border border-amber-400/20 bg-amber-400/[0.08] p-7">
          <p className="text-xs uppercase tracking-[0.3em] text-amber-200">
            Assessment controls
          </p>

          <h2 className="mt-3 text-2xl font-semibold text-white">
            Portal lifecycle management
          </h2>

          <p className="mt-4 max-w-3xl leading-7 text-slate-300">
            Revoke vendor access, regenerate the current portal token, or cancel
            the assessment workflow if it was launched accidentally.
          </p>

          <AssessmentPortalControls assessmentId={assessment.id} variant="panel" />
        </section>
<section className="mt-10 rounded-[2rem] border border-white/10 bg-white/[0.04] p-7">
        <p className="text-xs uppercase tracking-[0.3em] text-cyan-200">Secure vendor link</p>
        <h2 className="mt-3 text-3xl font-semibold">Send this link to the vendor.</h2>
        <p className="mt-4 max-w-3xl leading-8 text-slate-300">
          The vendor can complete the questionnaire without logging into your workspace.
          Once submitted, Truvern will mark the assessment review-ready.
        </p>
        <div className="mt-6 rounded-3xl border border-cyan-400/20 bg-slate-950/70 p-5 shadow-2xl shadow-cyan-950/20">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

          <p className="break-all font-mono text-sm text-cyan-100">
            {vendorUrl || "No vendor token available"}
          </p>

          {vendorUrl ? (
            <div className="flex flex-wrap gap-3">
              <Link
                href={vendorUrl}
                className="rounded-full bg-cyan-300 px-5 py-2 text-xs font-semibold text-slate-950 transition hover:bg-cyan-200"
              >
                Open vendor portal
              </Link>

              <CopyVendorAssessmentLinkButton path={vendorUrl} />
            </div>
          ) : null}
        </div>

        <div className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-xs leading-6 text-amber-100">
          This vendor link is persistent and reusable until the assessment is completed,
          revoked, or regenerated by Truvern operations.
        </div>
      </div>
      </section>
    </main>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
      <p className="text-xs uppercase tracking-[0.22em] text-slate-500">{label}</p>
      <p className="mt-2 text-sm font-semibold text-white">{value}</p>
    </div>
  );
}










