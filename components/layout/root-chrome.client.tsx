"use client";

import Image from "next/image";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import NotificationBell from "@/components/layout/notification-bell.client";
import TruvernLogo from "@/components/truvern-logo";
import { SignedIn, SignedOut, SignOutButton, useClerk , UserButton, useUser } from "@clerk/nextjs";
import { usePathname } from "next/navigation";
import PublicSiteFooter from "@/components/marketing/public-site-footer";

const publicRoutes = [
  "/",
  "/features",
  "/pricing",
  "/trust-network",
  "/demo",
  "/truvern-reviews",
  "/contact",
  "/security",
  "/privacy",
  "/terms",
  "/dpa",
  "/subprocessors",
  "/cookies",
  "/health",
  "/help",
  "/board-packet",
  "/verify",
];

const marketingLinks = [
  { href: "/", label: "Product" },
  { href: "/features", label: "Features" },
  { href: "/trust-network", label: "Trust Network" },
  { href: "/demo", label: "Demo" },
  { href: "/truvern-reviews", label: "Truvern Reviews" },
  { href: "/governance-ops", label: "Governance Ops" },
  { href: "/pricing", label: "Pricing" },
  { href: "/contact", label: "Contact" },
];

const appLinks = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/vendors", label: "Vendors" },
  { href: "/truvern-reviews", label: "Truvern Reviews" },
  { href: "/governance-ops", label: "Governance Ops" },
  { href: "/assessments/catalog", label: "Assessments" },
  { href: "/billing/credits", label: "Credits" },
  { href: "/billing/plans", label: "Plans" },
];

function isPublicRoute(pathname: string) {
  if (pathname === "/") return true;

  return publicRoutes.some((route) => {
    if (route === "/") return false;
    return pathname === route || pathname.startsWith(`${route}/`);
  });
}

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={[
        "text-sm transition",
        active ? "text-white" : "text-slate-400 hover:text-white",
      ].join(" ")}
    >
      {label}
    </Link>
  );
}

function Brand() {
  return (
    <Link
      href="/"
      className="flex items-center gap-3 text-white transition hover:opacity-90"
    >
      <Image
  src="/truvern-mark.svg"
  alt="Truvern"
  width={40}
  height={40}
  className="rounded-xl"
 />

      <span className="text-lg font-semibold tracking-tight">Truvern</span>
    </Link>
  );
}

function PublicNav({
  pathname,
  mobileMenuOpen,
  setMobileMenuOpen,
}: {
  pathname: string;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#020617]/90 backdrop-blur">
      <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-2 px-4 py-3 sm:min-h-20 sm:px-6">
        <div className="flex min-w-0 items-center gap-8">
          <Brand />

          <nav className="hidden items-center gap-5 xl:flex">
            {marketingLinks.map((link) => (
              <NavLink
                key={link.href}
                href={link.href}
                label={link.label}
                active={isActive(pathname, link.href)}
              />
            ))}
          </nav>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <div className="hidden items-center gap-2 sm:flex">
            <SignedOut>
              <Link
                href="/sign-in"
                className="text-sm font-medium text-slate-300 transition hover:text-white"
              >
                Sign in
              </Link>

              <Link
                href="/sign-up"
                className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2.5 text-sm font-semibold text-cyan-100 transition hover:border-cyan-300/50 hover:bg-cyan-300/20"
              >
                Get started
              </Link>
            </SignedOut>

            <SignedIn>
              <Link
                href="/dashboard"
                className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2.5 text-sm font-semibold text-cyan-100 transition hover:border-cyan-300/50 hover:bg-cyan-300/20"
              >
                Dashboard
              </Link>

              <SignOutButton>
                <button
                  type="button"
                  className="text-sm font-medium text-slate-300 transition hover:text-white"
                >
                  Sign out
                </button>
              </SignOutButton>
            </SignedIn>
          </div>

          <button
            type="button"
            onClick={() => setMobileMenuOpen((open) => !open)}
            aria-label={
              mobileMenuOpen
                ? "Close navigation menu"
                : "Open navigation menu"
            }
            aria-expanded={mobileMenuOpen}
            aria-controls="public-mobile-navigation"
            className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-slate-200 transition hover:bg-white/[0.08] xl:hidden"
          >
            {mobileMenuOpen ? (
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            ) : (
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {mobileMenuOpen ? (
        <div
          id="public-mobile-navigation"
          className="border-t border-white/10 bg-[#020617] xl:hidden"
        >
          <div className="mx-auto max-w-7xl space-y-2 px-4 py-4 sm:px-6">
            <nav className="space-y-2" aria-label="Mobile public navigation">
              {marketingLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={[
                    "block rounded-2xl border px-4 py-3 text-sm font-medium transition",
                    isActive(pathname, link.href)
                      ? "border-cyan-400/30 bg-cyan-400/10 text-cyan-100"
                      : "border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.06] hover:text-white",
                  ].join(" ")}
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            <div className="grid gap-2 border-t border-white/10 pt-4 sm:grid-cols-2">
              <SignedOut>
                <Link
                  href="/sign-in"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex min-h-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.06]"
                >
                  Sign in
                </Link>

                <Link
                  href="/sign-up"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex min-h-11 items-center justify-center rounded-2xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-3 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-300/20"
                >
                  Get started
                </Link>
              </SignedOut>

              <SignedIn>
                <Link
                  href="/dashboard"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex min-h-11 items-center justify-center rounded-2xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-3 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-300/20"
                >
                  Dashboard
                </Link>

                <SignOutButton>
                  <button
                    type="button"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex min-h-11 w-full items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.06]"
                  >
                    Sign out
                  </button>
                </SignOutButton>
              </SignedIn>
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}
function AppNav({
  pathname,
  mobileMenuOpen,
  setMobileMenuOpen,
}: {
  pathname: string;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  
  const { user } = useUser();

  const accountLabel =
    user?.fullName ||
    user?.primaryEmailAddress?.emailAddress ||
    "Account";

  const [currentPlan, setCurrentPlan] = useState<"FREE" | "PRO" | "ENTERPRISE">("FREE");
  const [isOperator, setIsOperator] = useState(false);

  useEffect(() => {
    fetch("/api/billing/current-plan", { cache: "no-store" })
      .then((res) => res.json())
      .then((json) => {
        const plan = String(json?.plan || "FREE").toUpperCase();

        if (plan === "FREE" || plan === "PRO" || plan === "ENTERPRISE") {
          setCurrentPlan(plan);
        }
      })
      .catch(() => setCurrentPlan("FREE"));
  }, []);

  useEffect(() => {
    fetch("/api/truvern/ops/me", { cache: "no-store" })
      .then((res) => res.json())
      .then((json) => setIsOperator(Boolean(json?.isOperator)))
      .catch(() => setIsOperator(false));
  }, []);

return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#020617]/95 backdrop-blur">
      <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-2 px-4 py-3 sm:min-h-20 sm:px-6">
        <div className="flex min-w-0 items-center gap-8">
          <Link
            href="/dashboard"
            className="flex items-center gap-3 text-white transition hover:opacity-90"
          >
            <Image
  src="/truvern-mark.svg"
  alt="Truvern"
  width={40}
  height={40}
  className="rounded-xl"
 />

            <span className="text-lg font-semibold tracking-tight">
              Truvern
            </span>
          </Link>

          <nav className="hidden items-center gap-5 xl:flex">
            {appLinks.map((link) => (
              <NavLink
                key={link.href}
                href={link.href}
                label={link.label}
                active={isActive(pathname, link.href)}
              />
            ))}

            {isOperator ? (
              <NavLink
                href="/truvern/ops"
                label="Ops"
                active={isActive(pathname, "/truvern/ops")}
              />
            ) : null}
          </nav>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() => setMobileMenuOpen((v) => !v)}
            aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={mobileMenuOpen}
            className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-slate-200 transition hover:bg-white/[0.08] xl:hidden"
          >
            {mobileMenuOpen ? (
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            ) : (
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            )}
          </button>

          <NotificationBell />

          <div className="hidden items-center gap-3 xl:flex">
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
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-200">
                Plan · {currentPlan}
              </p>
            </div>
          </div>

          <Link
            href="/"
            className="hidden text-sm font-medium text-slate-400 transition hover:text-white xl:inline-flex"
          >
            Public site
          </Link>
        </div>
      </div>

      {mobileMenuOpen ? (
        <div className="border-t border-white/10 bg-[#020617] xl:hidden">
          <div className="mx-auto max-w-7xl space-y-2 px-4 py-4 sm:px-6">
            {appLinks.map((link) => {
              const active = isActive(pathname, link.href);

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={[
                    "block rounded-2xl border px-4 py-3 text-sm transition",
                    active
                      ? "border-cyan-400/30 bg-cyan-400/10 text-white"
                      : "border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.06]",
                  ].join(" ")}
                >
                  {link.label}
                </Link>
              );
            })}

            <div className="pt-3">
              <Link
                href="/"
                onClick={() => setMobileMenuOpen(false)}
                className="block rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-300 transition hover:bg-white/[0.06]"
              >
                Public site
              </Link>
            </div>

            <div className="pt-2">
<SignOutButton>
                <button className="w-full rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-left text-sm text-red-100 transition hover:bg-red-500/20">
                  Sign out
                </button>
              </SignOutButton>
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}

export default function RootChrome({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const publicPage =
    isPublicRoute(pathname) ||
    pathname.startsWith("/sign-in") ||
    pathname.startsWith("/sign-up");
  const { signOut } = useClerk();
  const { user } = useUser();

  const accountLabel =
    user?.fullName ||
    user?.primaryEmailAddress?.emailAddress ||
    "Account";

  const [showIdleWarning, setShowIdleWarning] = useState(false);
  const [currentPlan, setCurrentPlan] = useState<"FREE" | "PRO" | "ENTERPRISE">("FREE");
  const [isOperator, setIsOperator] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const warningTimerRef = useRef<NodeJS.Timeout | null>(null);
  const logoutTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (publicPage) {
      return;
    }

    const WARNING_MS = 15 * 60 * 1000;
    const LOGOUT_MS = 20 * 60 * 1000;

    function clearTimers() {
      if (warningTimerRef.current) {
        clearTimeout(warningTimerRef.current);
      }

      if (logoutTimerRef.current) {
        clearTimeout(logoutTimerRef.current);
      }
    }

    async function forceLogout() {
      try {
        await signOut({
          redirectUrl: "/sign-in?reason=idle-timeout",
        });
      } catch (error) {
        console.error("Idle sign out failed", error);
      }
    }

    function resetTimers() {
      clearTimers();

      setShowIdleWarning(false);

      warningTimerRef.current = setTimeout(() => {
        setShowIdleWarning(true);
      }, WARNING_MS);

      logoutTimerRef.current = setTimeout(() => {
        forceLogout();
      }, LOGOUT_MS);
    }

    const events = [
      "mousemove",
      "mousedown",
      "keydown",
      "scroll",
      "touchstart",
      "click",
    ];

    events.forEach((event) => {
      window.addEventListener(event, resetTimers, { passive: true });
    });

    resetTimers();

    return () => {
      clearTimers();

      events.forEach((event) => {
        window.removeEventListener(event, resetTimers);
      });
    };
  }, [publicPage, signOut]);

  return (
    <div className="min-h-screen overflow-x-clip bg-[radial-gradient(circle_at_top,rgba(14,165,233,0.12),transparent_45%),linear-gradient(to_bottom,#020617,#020617)]">
      {publicPage ? (
        <PublicNav
          pathname={pathname}
          mobileMenuOpen={mobileMenuOpen}
          setMobileMenuOpen={setMobileMenuOpen}
        />
      ) : (
        <AppNav
          pathname={pathname}
          mobileMenuOpen={mobileMenuOpen}
          setMobileMenuOpen={setMobileMenuOpen}
        />
      )}
      {children}
      {publicPage ? <PublicSiteFooter /> : null}

      {showIdleWarning ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm">
          <div className="my-auto w-full max-w-md rounded-3xl border border-amber-400/20 bg-[#04111f] p-5 shadow-2xl sm:p-6">
            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-200">
                !
              </div>

              <div>
                <h2 className="text-lg font-semibold text-white">
                  Session timeout warning
                </h2>

                <p className="mt-1 text-sm text-slate-300">
                  Truvern will automatically sign you out after inactivity.
                </p>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-sm leading-6 text-slate-300">
                Move the mouse, scroll, or press any key to continue your secure session.
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}





























































