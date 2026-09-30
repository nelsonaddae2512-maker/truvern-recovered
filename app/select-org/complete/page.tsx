import type { Metadata } from "next";
import { Suspense } from "react";

import SelectOrgCompleteClient from "@/components/select-org/select-org-complete.client";

export const metadata: Metadata = {
  title: "Preparing workspace | Truvern",
  robots: {
    index: false,
    follow: false,
    noarchive: true,
  },
};

function PreparingWorkspaceFallback() {
  return (
    <div
      aria-live="polite"
      className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"
    >
      <div className="text-sm font-semibold text-white">
        Preparing your Truvern workspace…
      </div>
      <div className="mt-2 text-sm text-slate-300">
        Verifying your organization access.
      </div>
    </div>
  );
}

export default function SelectOrganizationCompletePage() {
  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-2xl items-center px-4 py-12 sm:px-6">
      <section className="w-full">
        <Suspense fallback={<PreparingWorkspaceFallback />}>
          <SelectOrgCompleteClient />
        </Suspense>
      </section>
    </main>
  );
}
