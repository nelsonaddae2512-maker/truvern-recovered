import clsx from "clsx";

export function Title({ children, className = "" }: React.PropsWithChildren<{ className?: string }>) {
  return <h1 className={clsx("text-2xl md:text-3xl font-bold tracking-tight", className)}>{children}</h1>;
}

