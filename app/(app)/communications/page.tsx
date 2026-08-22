import { redirect } from "next/navigation";

import CommunicationsCenter from "@/components/communications/communications-center.client";
import { requireDbOrganization } from "@/lib/org-db";
import { canUseCommunications, getCurrentOrgPlanTier } from "@/lib/billing/plan-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Communications | Truvern",
  description:
    "View governance communications, vendor correspondence, and review activity.",
  robots: {
    index: false,
    follow: false,
    noarchive: true,
    nosnippet: true,
    noimageindex: true,
  },
};

export default async function CommunicationsPage() {
  const org = await requireDbOrganization();

  if ("_needsOrgSelection" in org) {
    redirect("/dashboard");
  }

  const planTier = await getCurrentOrgPlanTier();
  const communicationsAllowed =
    await canUseCommunications(planTier);

  if (!communicationsAllowed) {
    redirect("/plans?feature=communications");
  }

  return (
    <main className="mx-auto w-full max-w-[1600px] px-4 py-8 text-white sm:px-6 lg:px-8 lg:py-10">
      <section className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="inline-flex rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200">
            Governance communications
          </div>

          <h1 className="mt-5 text-4xl font-semibold tracking-tight sm:text-5xl">
            Communications Center
          </h1>

          <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300 sm:text-base">
            Review vendor messages, assessment correspondence, delivery status,
            and governance communication history from one organization-scoped
            workspace.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <a
            href="/vendors"
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/15 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            Open vendors
          </a>

          <a
            href="/review-desk"
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-cyan-300 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
          >
            Open Review Desk
          </a>
        </div>
      </section>

      <CommunicationsCenter
        organizationId={org.id}
      />
    </main>
  );
}
