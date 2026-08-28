import { redirect } from "next/navigation";
import StartInternalReview from "@/components/review-desk/start-internal-review.client";

type Props = {
  searchParams?: Promise<{
    assessmentId?: string;
    vendorId?: string;
  }>;
};

function safeInt(value: unknown) {
  const n =
    Number(String(value ?? "").trim());

  return Number.isFinite(n) && n > 0
    ? Math.floor(n)
    : null;
}

export default async function StartReviewPage({
  searchParams,
}: Props) {
  const resolved =
    (await searchParams) ?? {};

  const assessmentId =
    safeInt(resolved.assessmentId);

  const vendorId =
    safeInt(resolved.vendorId);

  if (!assessmentId || !vendorId) {
    redirect("/review-desk");
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-10">
      <section className="rounded-2xl border border-white/10 bg-slate-950/70 p-6 shadow-xl">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">
          Self-Managed Review
        </p>

        <h1 className="mt-3 text-2xl font-semibold text-white">
          Start governance review
        </h1>

        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
          Start the internal governance review for
          Assessment #{assessmentId}. The review is
          created only after you confirm below.
        </p>

        <StartInternalReview
          assessmentId={assessmentId}
          vendorId={vendorId}
          cancelHref="/review-desk"
        />
      </section>
    </main>
  );
}