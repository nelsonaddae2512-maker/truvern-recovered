"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export default function PrintPacketButton() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const printedRef = useRef(false);

  useEffect(() => {
    if (searchParams.get("print") !== "1") return;
    if (printedRef.current) return;

    printedRef.current = true;

    const timer = window.setTimeout(() => {
      window.focus();
      window.print();

      const next = new URLSearchParams(searchParams.toString());
      next.delete("print");

      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }, 500);

    return () => window.clearTimeout(timer);
  }, [pathname, router, searchParams]);

  function handlePrint() {
    const next = new URLSearchParams(searchParams.toString());
    next.set("print", "1");

    router.push(`${pathname}?${next.toString()}`, { scroll: false });
  }

  return (
    <button
      type="button"
      onClick={handlePrint}
      className="rounded-2xl bg-slate-950 px-5 py-3 text-center text-sm font-semibold text-white"
    >
      Print / Save PDF
    </button>
  );
}

