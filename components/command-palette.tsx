"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type QuickLink = {
  label: string;
  description: string;
  href: string;
  group: "Navigation" | "Actions" | "Billing";
};

type VendorResult = {
  id: number;
  name: string;
  riskScore: number | null;
  createdAt: string | Date;
};

const QUICK_LINKS: QuickLink[] = [
  {
    label: "Home dashboard",
    description: "Overview of your Truvern workspace",
    href: "/",
    group: "Navigation",
  },
  {
    label: "Trust Network",
    description: "Public gallery of trusted vendors",
    href: "/trust",
    group: "Navigation",
  },
  {
    label: "Vendors",
    description: "Browse all vendors in your workspace",
    href: "/vendors",
    group: "Navigation",
  },
  {
    label: "Governance Ops",
    description: "Operational governance review workspace",
    href: "/review-desk",
    group: "Navigation",
  },
  {
    label: "Board report",
    description: "Board-ready third-party risk report",
    href: "/board-report",
    group: "Navigation",
  },
  {
    label: "Pricing",
    description: "Plans for scaling Truvern",
    href: "/pricing",
    group: "Navigation",
  },
  {
    label: "Credits & Billing",
    description:
      "Purchase governance capacity and manage Truvern credits",
    href: "/billing/credits",
    group: "Billing",
  },
  {
    label: "Funding Operations",
    description:
      "View available, reserved, consumed, and effective credits",
    href: "/billing/credits",
    group: "Billing",
  },
  {
    label: "Contact Truvern",
    description: "Talk to the Truvern team",
    href: "/contact",
    group: "Navigation",
  },
  {
    label: "Open vendor space",
    description: "Jump into your secure vendor workspace",
    href: "/vendor-space",
    group: "Actions",
  },
];

export default function CommandPalette() {
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const [vendorResults, setVendorResults] = useState<VendorResult[]>([]);
  const [loadingVendors, setLoadingVendors] = useState(false);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const isK = e.key.toLowerCase() === "k";

      if ((e.metaKey || e.ctrlKey) && isK) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }

      if (e.key === "Escape") {
        setOpen(false);
      }
    }

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  useEffect(() => {
    if (!open) return;

    const trimmed = query.trim();

    if (trimmed.length < 2) {
      setVendorResults([]);
      setLoadingVendors(false);
      return;
    }

    let cancelled = false;

    const controller = new AbortController();

    async function run() {
      try {
        setLoadingVendors(true);

        const res = await fetch(
          `/api/search/vendors?q=${encodeURIComponent(trimmed)}&take=8`,
          {
            signal: controller.signal,
          },
        );

        if (!res.ok) {
          throw new Error("Search failed");
        }

        const data = (await res.json()) as {
          vendors: VendorResult[];
        };

        if (!cancelled) {
          setVendorResults(data.vendors ?? []);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Vendor search failed", error);
          setVendorResults([]);
        }
      } finally {
        if (!cancelled) {
          setLoadingVendors(false);
        }
      }
    }

    run();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [open, query]);

  const filteredQuickLinks = useMemo(() => {
    const trimmed = query.trim().toLowerCase();

    if (!trimmed) {
      return QUICK_LINKS;
    }

    return QUICK_LINKS.filter((link) => {
      const haystack =
        `${link.label} ${link.description}`.toLowerCase();

      return haystack.includes(trimmed);
    });
  }, [query]);

  const items = useMemo(() => {
    type Item =
      | {
          type: "quick";
          link: QuickLink;
        }
      | {
          type: "vendor";
          vendor: VendorResult;
        };

    const result: Item[] = [];

    filteredQuickLinks.forEach((link) => {
      result.push({
        type: "quick",
        link,
      });
    });

    vendorResults.forEach((vendor) => {
      result.push({
        type: "vendor",
        vendor,
      });
    });

    return result;
  }, [filteredQuickLinks, vendorResults]);

  useEffect(() => {
    if (!open) return;

    setActiveIndex(0);
  }, [open, query, items.length]);

  function handleSelect(index: number) {
    const item = items[index];

    if (!item) {
      return;
    }

    if (item.type === "quick") {
      router.push(item.link.href);
    } else {
      router.push(`/vendors/${item.vendor.id}`);
    }

    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (!open) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();

      setActiveIndex((prev) =>
        (prev + 1) % Math.max(items.length || 1, 1),
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();

      setActiveIndex((prev) =>
        prev - 1 < 0
          ? Math.max(items.length - 1, 0)
          : prev - 1,
      );
    } else if (e.key === "Enter") {
      e.preventDefault();

      handleSelect(activeIndex);
    }
  }

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-start justify-center bg-black/60 px-4 pt-24 backdrop-blur-sm"
      onKeyDown={onKeyDown}
    >
      <div className="w-full max-w-xl rounded-2xl border border-slate-800 bg-slate-950/95 shadow-xl shadow-black/60">
        <div className="flex items-center gap-2 border-b border-slate-800 px-3 py-2.5">
          <span className="rounded-md bg-slate-900 px-2 py-1 text-[10px] text-slate-400">
            ⌘K
          </span>

          <input
            autoFocus
            className="h-8 w-full bg-transparent text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none"
            placeholder="Search vendors, governance tools, credits, and actions…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />

          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-md px-2 py-1 text-[11px] text-slate-400 hover:bg-slate-900 hover:text-slate-100"
          >
            Esc
          </button>
        </div>

        <div className="max-h-80 overflow-y-auto py-2 text-sm">
          {items.length === 0 && !loadingVendors ? (
            <p className="px-4 py-6 text-center text-xs text-slate-500">
              No results found.
            </p>
          ) : null}

          {filteredQuickLinks.length > 0 ? (
            <div className="px-2 pb-1 pt-1">
              {["Navigation", "Billing", "Actions"].map((group) => {
                const groupLinks =
                  filteredQuickLinks.filter(
                    (link) => link.group === group,
                  );

                if (groupLinks.length === 0) {
                  return null;
                }

                return (
                  <div key={group} className="mb-1">
                    <p className="px-2 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500">
                      {group}
                    </p>

                    {groupLinks.map((link) => {
                      const index = items.findIndex(
                        (it) =>
                          it.type === "quick" &&
                          it.link.href === link.href &&
                          it.link.label === link.label,
                      );

                      const isActive =
                        index === activeIndex;

                      return (
                        <button
                          key={`${link.href}-${link.label}`}
                          type="button"
                          onMouseEnter={() =>
                            setActiveIndex(index)
                          }
                          onClick={() =>
                            handleSelect(index)
                          }
                          className={`flex w-full flex-col items-start rounded-xl px-2.5 py-2 text-left text-xs ${
                            isActive
                              ? "bg-emerald-500/10 text-slate-50"
                              : "text-slate-200 hover:bg-slate-900"
                          }`}
                        >
                          <span className="font-medium">
                            {link.label}
                          </span>

                          <span className="mt-0.5 text-[11px] text-slate-400">
                            {link.description}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          ) : null}

          {query.trim().length >= 2 ? (
            <div className="px-2 pt-1">
              <p className="px-2 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500">
                Vendors
              </p>

              {loadingVendors ? (
                <p className="px-4 py-3 text-[11px] text-slate-500">
                  Searching vendors…
                </p>
              ) : null}

              {!loadingVendors &&
              vendorResults.length === 0 ? (
                <p className="px-4 py-3 text-[11px] text-slate-500">
                  No vendors match “{query.trim()}”.
                </p>
              ) : null}

              {vendorResults.map((vendor) => {
                const index = items.findIndex(
                  (it) =>
                    it.type === "vendor" &&
                    it.vendor.id === vendor.id,
                );

                const isActive =
                  index === activeIndex;

                const score =
                  vendor.riskScore ?? 0;

                return (
                  <button
                    key={vendor.id}
                    type="button"
                    onMouseEnter={() =>
                      setActiveIndex(index)
                    }
                    onClick={() =>
                      handleSelect(index)
                    }
                    className={`flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left text-xs ${
                      isActive
                        ? "bg-emerald-500/10 text-slate-50"
                        : "text-slate-200 hover:bg-slate-900"
                    }`}
                  >
                    <div>
                      <span className="font-medium">
                        {vendor.name}
                      </span>

                      <span className="ml-2 text-[11px] text-slate-500">
                        Vendor profile
                      </span>
                    </div>

                    <span className="text-[11px] text-emerald-300">
                      {score}/100
                    </span>
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>

        <div className="border-t border-slate-800 px-3 py-2 text-[10px] text-slate-500">
          <span className="mr-3">
            Press{" "}
            <span className="rounded bg-slate-900 px-1">
              ⌘K
            </span>{" "}
            or{" "}
            <span className="rounded bg-slate-900 px-1">
              Ctrl+K
            </span>{" "}
            anywhere to open.
          </span>
        </div>
      </div>
    </div>
  );
}



