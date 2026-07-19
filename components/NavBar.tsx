// components/NavBar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Home" },
  { href: "/trust", label: "Trust Network" },
  { href: "/vendors", label: "Vendors" },
  { href: "/reports/board", label: "Board Report" },
];

export function NavBar() {
  const pathname = usePathname();

  return (
    <header className="truvern-nav">
      <div className="truvern-nav-inner">
        <Link href="/" className="truvern-nav-brand">
          Truvern
        </Link>
        <nav className="truvern-nav-links">
          {links.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`truvern-nav-link ${
                  active ? "bg-slate-800 text-white" : ""
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}

export default NavBar;


