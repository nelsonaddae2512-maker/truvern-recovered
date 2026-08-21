import AtlasRefactoringPlanner from "@/components/atlas/atlas-refactoring-planner.client";

export const dynamic = "force-dynamic";

export default function AtlasRefactoringPlannerPage() {
  return (
    <main className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
      <AtlasRefactoringPlanner />
    </main>
  );
}
