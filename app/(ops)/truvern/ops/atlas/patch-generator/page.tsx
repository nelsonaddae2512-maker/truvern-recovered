import AtlasPatchGenerator from "@/components/atlas/atlas-patch-generator.client";

export const dynamic = "force-dynamic";

export default function AtlasPatchGeneratorPage() {
  return (
    <main className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
      <AtlasPatchGenerator />
    </main>
  );
}
