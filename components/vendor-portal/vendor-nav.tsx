import Link from "next/link";
import { UserButton } from "@clerk/nextjs";

function clsx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export default function VendorPortalNav({
  activePath,
  vendorName,
}: {
  activePath: string;
  vendorName?: string | null;
}) {
  const isActive = (href: string) =>
    activePath === href || activePath.startsWith(href + "/");

  const linkClass = (href: string) =>
    clsx(
      "btn-glass px-3 py-2 text-sm",
      isActive(href) && "ring-1 ring-white/20 bg-white/10"
    );

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-black/30 backdrop-blur">
      <div className="container-page py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/vendor-portal" className="flex items-center gap-2">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 border border-white/10">
              <span className="text-sm font-semibold">T</span>
            </span>
            <div className="leading-tight">
              <div className="text-sm font-semibold">Truvern</div>
              <div className="text-xs opacity-70">
                {vendorName ? `${vendorName} — Vendor Portal` : "Vendor Portal"}
              </div>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-2 ml-3">
            <Link href="/vendor-portal" className={linkClass("/vendor-portal")}>
              Home
            </Link>
            <Link
              href="/vendor-portal/evidence-requests"
              className={linkClass("/vendor-portal/evidence-requests")}
            >
              Evidence Requests
            </Link>
            <Link
              href="/vendor-portal/assessments"
              className={linkClass("/vendor-portal/assessments")}
            >
              Assessments
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/vendor"
            className="btn-glass px-3 py-2 text-sm hidden sm:inline-flex"
          >
            Back to App
          </Link>

          <div className="ml-1">
            <UserButton afterSignOutUrl="/" />
          </div>
        </div>
      </div>

      {/* Mobile */}
      <div className="md:hidden border-t border-white/10">
        <div className="container-page py-2 flex items-center gap-2 overflow-x-auto">
          <Link href="/vendor-portal" className={linkClass("/vendor-portal")}>
            Home
          </Link>
          <Link
            href="/vendor-portal/evidence-requests"
            className={linkClass("/vendor-portal/evidence-requests")}
          >
            Evidence Requests
          </Link>
          <Link
            href="/vendor-portal/assessments"
            className={linkClass("/vendor-portal/assessments")}
          >
            Assessments
          </Link>
        </div>
      </div>
    </header>
  );
}


