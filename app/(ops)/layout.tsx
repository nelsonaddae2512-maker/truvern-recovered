import type { Metadata } from "next";
import { requireTruvernOperator } from "@/lib/truvern-ops-access";
import OpsSidebar from "@/components/truvern/ops/ops-sidebar.client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default async function TruvernOpsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireTruvernOperator();

  return (
    <div className="min-h-screen bg-[#020617] text-white">
      <div className="mx-auto flex max-w-7xl px-4 py-6 sm:px-6 lg:py-8">
        <OpsSidebar />

        <section className="min-w-0 flex-1">
          {children}
        </section>
      </div>
    </div>
  );
}



