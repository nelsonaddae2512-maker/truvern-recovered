import * as React from "react";
import clsx from "clsx";

export function Card({ className = "", children }: React.PropsWithChildren<{ className?: string }>) {
  return (
    <div className={clsx(
      "rounded-xl border border-zinc-200/60 bg-white shadow-sm dark:border-zinc-800/60 dark:bg-zinc-900",
      className
    )}>
      {children}
    </div>
  );
}

export function CardHeader({ className = "", children }: React.PropsWithChildren<{ className?: string }>) {
  return <div className={clsx("px-5 pt-5", className)}>{children}</div>;
}

export function CardTitle({ className = "", children }: React.PropsWithChildren<{ className?: string }>) {
  return <h3 className={clsx("text-lg font-semibold tracking-tight", className)}>{children}</h3>;
}

export function CardContent({ className = "", children }: React.PropsWithChildren<{ className?: string }>) {
  return <div className={clsx("px-5 pb-5", className)}>{children}</div>;
}

export function CardFooter({ className = "", children }: React.PropsWithChildren<{ className?: string }>) {
  return <div className={clsx("px-5 pb-5 border-t border-zinc-100 dark:border-zinc-800", className)}>{children}</div>;
}

