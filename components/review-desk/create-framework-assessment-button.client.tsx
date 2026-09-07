"use client";

import { useRouter } from "next/navigation";

type Props = {
  frameworkSlug: string;
  frameworkName: string;
};

const COMPREHENSIVE_NIST_SLUG = "nist-800-53-rev5";

export default function CreateFrameworkAssessmentButton({
  frameworkSlug,
  frameworkName,
}: Props) {
  const router = useRouter();

  const isComprehensiveNist =
    frameworkSlug === COMPREHENSIVE_NIST_SLUG;

  function beginAssessment() {
    if (isComprehensiveNist) {
      router.push(
        "/truvern/ops/comprehensive-reviews",
      );
      return;
    }

    router.push("/vendors");
  }

  return (
    <div>
      <button
        type="button"
        onClick={beginAssessment}
        className="rounded-full border border-emerald-300/30 bg-emerald-300/10 px-4 py-2 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-300/15"
      >
        {isComprehensiveNist
          ? "Start comprehensive review"
          : "Select vendor"}
      </button>

      <p className="mt-2 max-w-sm text-xs leading-5 text-slate-400">
        {isComprehensiveNist
          ? "Select the vendor first. Truvern will bind the comprehensive NIST assessment to that vendor before the assessment is created."
          : `Select a vendor before creating a ${frameworkName} assessment.`}
      </p>
    </div>
  );
}
