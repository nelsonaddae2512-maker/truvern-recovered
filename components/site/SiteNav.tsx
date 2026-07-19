import Link from "next/link";
import { Logo } from "./Logo";

export default function SiteNav() {
  return (
    <header className="sticky top-0 z-30 w-full border-b bg-white/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
        <Logo />
        <nav className="flex items-center gap-3">
          <Link href="/compare" className="rounded-md border px-3 py-1.5">Compare vendors</Link>
          <Link href="/assessment" className="rounded-md bg-black px-3 py-1.5 text-white">Get started</Link>
        </nav>
      </div>
    </header>
  );
}

