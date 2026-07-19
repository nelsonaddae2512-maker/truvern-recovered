import Link from "next/link";

export default function Logo({ size=28 }: { size?: number }) {
  return (
    <Link href="/" className="inline-flex items-center gap-2">
      <img src="/brand-logo.svg" width={size} height={size} alt="Truvern logo" />
      <span className="font-extrabold text-xl tracking-tight">Truvern</span>
    </Link>
  );
}

