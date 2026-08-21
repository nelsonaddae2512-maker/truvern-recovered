import type { Metadata } from "next";

import AtlasExplorer from "@/components/atlas/atlas-explorer.client";

export const metadata: Metadata = {
  title: "ATLAS Architecture Explorer | Truvern",
  description:
    "Explore Truvern architecture dependencies, impact paths, hotspots, and feature coupling.",
};

export default function AtlasExplorerPage() {
  return (
    <main className="min-h-screen bg-[#020617] text-slate-100">
      <AtlasExplorer />
    </main>
  );
}
