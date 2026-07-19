import Link from "next/link";
export function Logo({ size=28 }: { size?: number }) {
  return (
    <Link href="/" className="inline-flex items-center gap-2">
      <img src="/brand-mark.svg" width={size} height={size} alt="Truvern logo" />
      <img src="/brand-wordmark.svg" alt="Truvern" className="h-[22px] w-auto" />
    </Link>
  );
}

