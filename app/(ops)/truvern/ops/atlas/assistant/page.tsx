import type { Metadata } from "next";
import Link from "next/link";

import AtlasAssistant from "@/components/atlas/atlas-assistant.client";

export const metadata: Metadata = {
  title: "ATLAS Architecture Assistant | Truvern",
  description:
    "Ask graph-grounded questions about the Truvern architecture and change impact.",
};

export default function AtlasAssistantPage() {
  return (
    <main className="min-h-screen bg-[#020617] text-slate-100">
      <div className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-4 flex justify-end">
          <Link
            href="/truvern/ops/atlas"
            className="rounded-xl border border-white/10 bg-white/[0.035] px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.07]"
          >
            Open Architecture Explorer
          </Link>
        </div>
        <AtlasAssistant />
      </div>
    </main>
  );
}
