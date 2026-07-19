// components/Footer.tsx
import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-slate-800 bg-slate-950/90 text-xs text-slate-400">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-4 md:flex-row md:px-6">
        <div>&copy; {new Date().getFullYear()} Truvern. All rights reserved.</div>
        <div className="flex gap-4">
          <Link href="/legal/terms" className="hover:text-slate-200">
            Terms
          </Link>
          <Link href="/legal/privacy" className="hover:text-slate-200">
            Privacy
          </Link>
          <Link href="/ops/health" className="hover:text-slate-200">
            Health
          </Link>
        </div>
      </div>
    </footer>
  );
}

export default Footer;

