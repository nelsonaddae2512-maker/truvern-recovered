// components/board/print-pdf-button.tsx
"use client";

export default function PrintPdfButton({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className={className}
    >
      {children ?? "Print / Save PDF"}
    </button>
  );
}

