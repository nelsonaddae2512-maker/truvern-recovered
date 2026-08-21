import type { Metadata } from "next";
import Link from "next/link";

import AtlasReleaseIntelligence from "@/components/atlas/atlas-release-intelligence.client";

export const metadata: Metadata = {
  title: "ATLAS Release Intelligence | Truvern",
  description:
    "Compare ATLAS architecture snapshots and assess release readiness.",
};

export default function AtlasReleaseIntelligencePage() {
  return (
    <main className="min-h-screen bg-[#020617] text-slate-100">
      <div className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-4 flex flex-wrap justify-end gap-2">
          <Link
            href="/truvern/ops/atlas/assistant"
            className="rounded-xl border border-white/10 bg-white/[0.035] px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.07]"
          >
            Architecture Assistant
          </Link>
          <Link
            href="/truvern/ops/atlas"
            className="rounded-xl border border-white/10 bg-white/[0.035] px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.07]"
          >
            Architecture Explorer
          </Link>
        </div>
        <AtlasReleaseIntelligence />
      </div>
    </main>
  );
}
