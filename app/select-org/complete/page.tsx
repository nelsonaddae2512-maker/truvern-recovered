import type { Metadata } from "next";

import SelectOrgCompleteClient from "@/components/select-org/select-org-complete.client";

export const metadata: Metadata = {
  title: "Preparing workspace | Truvern",
  robots: {
    index: false,
    follow: false,
    noarchive: true,
  },
};

export default function SelectOrganizationCompletePage() {
  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-2xl items-center px-4 py-12 sm:px-6">
      <section className="w-full">
        <SelectOrgCompleteClient />
      </section>
    </main>
  );
}