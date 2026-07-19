// components/board-report-print-button.tsx
"use client";

export default function BoardReportPrintButton() {
  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  return (
    <button
      type="button"
      onClick={handlePrint}
      className="inline-flex items-center gap-1 rounded-full border border-slate-700 px-3 py-1 text-xs font-medium text-slate-200 hover:bg-slate-800 transition-colors print:hidden"
    >
      <span className="hidden sm:inline">Print layout</span>
      <span className="sm:hidden">Print</span>
    </button>
  );
}

