import AtlasSemanticIntelligence from "@/components/atlas/atlas-semantic-intelligence.client";

export const dynamic = "force-dynamic";

export default function AtlasSemanticIntelligencePage() {
  return (
    <main className="mx-auto w-full max-w-[1700px] px-4 py-6 sm:px-6 lg:px-8">
      <AtlasSemanticIntelligence />
    </main>
  );
}
