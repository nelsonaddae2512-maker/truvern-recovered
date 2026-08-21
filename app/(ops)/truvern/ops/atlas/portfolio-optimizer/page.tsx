import AtlasPortfolioOptimizer from "@/components/atlas/atlas-portfolio-optimizer.client";

export const dynamic = "force-dynamic";

export default function AtlasPortfolioOptimizerPage() {
  return (
    <main className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
      <AtlasPortfolioOptimizer />
    </main>
  );
}
