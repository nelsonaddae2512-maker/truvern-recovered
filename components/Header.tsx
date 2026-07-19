import Link from "next/link";
import Logo from "./Logo";

export default function Header() {
  return (
    <header className="sticky top-0 z-30 w-full border-b bg-white/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Logo />
        <nav className="flex items-center gap-3">
          <Link href="/compare" className="px-3 py-1.5 rounded-md border">Compare vendors</Link>
          <Link href="/assessment" className="px-3 py-1.5 rounded-md bg-black text-white">Get started</Link>
        </nav>
      </div>
    </header>
  );
}

