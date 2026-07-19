"use client";
import Link from "next/link";

export default function SiteHeader() {
  return (
    <header className="border-b border-zinc-200/60 bg-white dark:border-zinc-800/60 dark:bg-zinc-900">
      <nav className="container mx-auto flex items-center justify-between px-6 py-3">
        <Link href="/" className="text-xl font-semibold text-zinc-800 dark:text-zinc-100">
          Truvern
        </Link>
        <div className="flex gap-6 text-sm text-zinc-600 dark:text-zinc-300">
          <Link href="/trust">Trust Network</Link>
          <Link href="/vendors">Vendors</Link>
          <Link href="/pricing">Pricing</Link>
          <Link href="/contact">Contact</Link>
        </div>
      </nav>
    </header>
  );
}

