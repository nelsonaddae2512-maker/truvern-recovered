"use client";

import { UserButton, useUser } from "@clerk/nextjs";
import Link from "next/link";
import { usePathname } from "next/navigation";
import NotificationBell from "@/components/layout/notification-bell.client";

const workspaceLinks = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/vendors", label: "Vendors" },
  { href: "/truvern-reviews", label: "Truvern Reviews" },
  { href: "/governance-ops", label: "Governance Ops" },
  { href: "/assessments", label: "Assessments" },
  { href: "/billing/credits", label: "Credits" },
  { href: "/billing/plans", label: "Plans" },
  { href: "/truvern/ops", label: "Ops" },
];

const publicLinks = [
  { href: "/", label: "Public site" },
  { href: "/trust-network", label: "Trust Network" },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function AppShellNav() {
  const pathname = usePathname();
  const { user } = useUser();

  const accountLabel =
    user?.fullName ||
    user?.primaryEmailAddress?.emailAddress ||
    "Account";

  const isWorkspace =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/vendors") ||
    pathname.startsWith("/governance-ops") || pathname.startsWith("/review-desk") || pathname.startsWith("/truvern-reviews") ||
    pathname.startsWith("/governance-ops") || pathname.startsWith("/review-desk") ||
    pathname.startsWith("/assessments") ||
    pathname.startsWith("/billing") ||
    pathname.startsWith("/truvern/ops");

  const links = isWorkspace ? workspaceLinks : publicLinks;

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#020617]/90 backdrop-blur">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6">
        <div className="flex items-center gap-10">
          <Link
            href={isWorkspace ? "/dashboard" : "/"}
            className="flex items-center gap-3 text-white transition hover:opacity-90"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-400/40 bg-cyan-400/10 text-sm font-semibold text-cyan-200">
              T
            </div>

            <span className="text-lg font-semibold tracking-tight">
              Truvern
            </span>
          </Link>

          <nav className="hidden items-center gap-6 md:flex">
            {links.map((link) => {
              const active = isActive(pathname, link.href);

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={[
                    "text-sm transition",
                    active ? "text-white" : "text-slate-400 hover:text-white",
                  ].join(" ")}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-4">
          {isWorkspace ? (
            <>
              <NotificationBell />

              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-cyan-400/30 bg-cyan-400/10 text-sm font-bold text-cyan-100">
                  {(accountLabel || "A").slice(0, 1).toUpperCase()}
                </div>

                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                    Signed in
                  </p>

                  <p className="max-w-[180px] truncate text-sm font-semibold text-white">
                    {accountLabel}
                  </p>
                </div>
              </div>

              <Link
                href="/"
                className="text-sm font-semibold text-slate-300 transition hover:text-white"
              >
                Public site
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/sign-in"
                className="text-sm font-medium text-slate-300 transition hover:text-white"
              >
                Sign in
              </Link>

              <Link
                href="/sign-up"
                className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-5 py-2.5 text-sm font-semibold text-cyan-100 transition hover:border-cyan-300/50 hover:bg-cyan-300/20"
              >
                Get started
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}














