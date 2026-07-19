"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

type Props = {
  enabled?: boolean;
  intervalMs?: number;
};

export default function VendorAssessmentAutoRefresh({
  enabled = true,
  intervalMs = 20000,
}: Props) {
  const router = useRouter();

  useEffect(() => {
    if (!enabled) return;

    const timer = window.setInterval(() => {
      router.refresh();
    }, intervalMs);

    return () => window.clearInterval(timer);
  }, [enabled, intervalMs, router]);

  return null;
}

