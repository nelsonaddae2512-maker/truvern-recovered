import clsx from "clsx";

type Variant = "default" | "success" | "warning" | "danger" | "info";

export function Badge({ children, className = "", variant = "default" }: {
  children: React.ReactNode;
  className?: string;
  variant?: Variant;
}) {
  const base = "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium";
  const look: Record<Variant, string> = {
    default: "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100",
    success: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
    warning: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
    danger:  "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200",
    info:    "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
  };
  return <span className={clsx(base, look[variant], className)}>{children}</span>;
}

