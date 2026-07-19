"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Props = {
  frameworkSlug: string;
  frameworkName: string;
};

export default function CreateFrameworkAssessmentButton({ frameworkSlug, frameworkName }: Props) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function createAssessment() {
    setError("");

    startTransition(async () => {
      const result = await fetch("/api/truvern/framework-assessments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          frameworkSlug,
          title: `${frameworkName} governance assessment`,
          requestedBy: "truvern-ops-library",
        }),
      });

      const json = await result.json().catch(() => ({}));

      if (!result.ok || !json.ok) {
        setError(json.error ?? "Failed to create assessment.");
        return;
      }

      router.push("/review-desk");
      router.refresh();
    });
  }

  return (
    <div>
      <button
        type="button"
        onClick={createAssessment}
        disabled={pending}
        className="rounded-full border border-emerald-300/30 bg-emerald-300/10 px-4 py-2 text-sm font-semibold text-emerald-100 hover:bg-emerald-300/15 disabled:opacity-50"
      >
        {pending ? "Creating..." : "Create assessment"}
      </button>

      {error ? <p className="mt-2 text-xs text-rose-300">{error}</p> : null}
    </div>
  );
}

