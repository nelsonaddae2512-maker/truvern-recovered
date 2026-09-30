import type { Metadata } from "next";

import SelectOrgClient from "@/components/select-org/select-org-client";

export const metadata: Metadata = {
  title: "Select organization | Truvern",
  robots: {
    index: false,
    follow: false,
    noarchive: true,
  },
};

export default function SelectOrganizationPage() {
  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-2xl items-center px-4 py-12 sm:px-6">
      <section className="w-full">
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">
            Truvern workspace
          </p>

          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">
            Select your organization
          </h1>

          <p className="mt-3 text-sm leading-6 text-slate-300">
            Choose the organization you want to use with Truvern, or create
            one if you do not have one yet.
          </p>
        </div>

        <SelectOrgClient />
      </section>
    </main>
  );
}