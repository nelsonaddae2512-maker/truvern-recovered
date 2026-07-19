import * as React from "react";
type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "brand" | "ghost";
};
export function Button({ variant="brand", className="", ...rest }: Props) {
  const base = variant === "brand" ? "btn-brand" : "btn-ghost";
  return <button className={`${base} ${className}`} {...rest} />;
}

