import type { Metadata } from "next";
import Link from "next/link";

import AtlasRepositoryGovernance from "@/components/atlas/atlas-repository-governance.client";

export const metadata: Metadata = {
  title: "ATLAS Repository Governance | Truvern",
  description:
    "Architecture policy enforcement and repository health governance for Truvern.",
};

export default function AtlasRepositoryGovernancePage() {
  return (
    <main className="min-h-screen bg-[#020617] text-slate-100">
      <div className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-4 flex flex-wrap justify-end gap-2">
          <Link
            href="/truvern/ops/atlas/engineering-copilot"
            className="rounded-xl border border-white/10 bg-white/[0.035] px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.07]"
          >
            Engineering Copilot
          </Link>
          <Link
            href="/truvern/ops/atlas/release-intelligence"
            className="rounded-xl border border-white/10 bg-white/[0.035] px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.07]"
          >
            Release Intelligence
          </Link>
          <Link
            href="/truvern/ops/atlas"
            className="rounded-xl border border-white/10 bg-white/[0.035] px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.07]"
          >
            Architecture Explorer
          </Link>
        </div>
        <AtlasRepositoryGovernance />
      </div>
    </main>
  );
}
