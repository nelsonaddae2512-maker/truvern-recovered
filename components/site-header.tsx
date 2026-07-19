// components/site-header.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  OrganizationSwitcher,
  SignedIn,
  SignedOut,
  SignInButton,
  UserButton,
} from "@clerk/nextjs";

function clsx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

const NAV = [
  { href: "/vendors", label: "Vendors" },
  { href: "/assessments", label: "Assessments" },
  { href: "/assessment/runs", label: "Runs" },
  { href: "/assessment-templates", label: "Templates" },
  // optional legacy (remove later)
  // { href: "/assessment/templates", label: "Templates (Legacy)" },
  { href: "/pricing", label: "Pricing" },
  { href: "/contact", label: "Contact" },
];

function isActivePath(pathname: string, href: string) {
  if (!pathname) return false;
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

export default function SiteHeader() {
  const pathname = usePathname() || "";

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/70 backdrop-blur">
      <div className="container-page flex h-14 items-center justify-between gap-3">
        {/* Left: Brand + Desktop Nav */}
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/" className="flex items-center gap-2 min-w-0">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-white/5 border border-white/10">
              <span className="text-sm font-semibold text-emerald-300">T</span>
            </span>
            <span className="font-semibold text-slate-50 truncate">Truvern</span>
          </Link>

          <nav className="hidden md:flex items-center gap-1 ml-2">
            {NAV.map((item) => {
              const active = isActivePath(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={clsx(
                    "btn-glass px-3 py-1.5 text-[12px]",
                    active &&
                      "border-emerald-400/50 text-emerald-200 bg-emerald-500/10"
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right: Org + Auth */}
        <div className="flex items-center gap-2">
          <SignedIn>
            <div className="hidden sm:block">
              <OrganizationSwitcher
                appearance={{
                  elements: {
                    rootBox: "max-w-[260px]",
                    organizationSwitcherTrigger:
                      "btn-glass px-3 py-1.5 text-[12px] text-slate-100",
                    organizationPreviewTextContainer: "block",
                  },
                }}
              />
            </div>

            <Link href="/board" className="btn-glass hidden sm:inline-flex">
              Board
            </Link>

            <UserButton
              appearance={{
                elements: {
                  userButtonTrigger:
                    "btn-glass px-2 py-1.5 text-[12px] text-slate-100",
                },
              }}
            />
          </SignedIn>

          <SignedOut>
            <SignInButton mode="modal">
              <button className="btn-primary">Sign in</button>
            </SignInButton>
          </SignedOut>
        </div>
      </div>

      {/* Mobile Nav */}
      <div className="md:hidden border-t border-white/10 bg-slate-950/50">
        <div className="container-page flex gap-2 overflow-x-auto py-2">
          {NAV.map((item) => {
            const active = isActivePath(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  "btn-glass whitespace-nowrap px-3 py-1.5 text-[12px]",
                  active &&
                    "border-emerald-400/50 text-emerald-200 bg-emerald-500/10"
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>
    </header>
  );
}

