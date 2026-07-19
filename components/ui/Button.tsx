import { ComponentProps } from "react";
export function Button({ className="", ...props }: ComponentProps<"a">) {
  return <a {...props} className={`inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition ${className}`} />;
}

