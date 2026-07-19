// components/org-menu.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CreateOrganization,
  SignedIn,
  useOrganization,
  useOrganizationList,
} from "@clerk/nextjs";

function clsx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export default function OrgMenu() {
  const { organization, isLoaded: orgLoaded } = useOrganization();
  const { userMemberships, setActive, isLoaded: listLoaded } =
    useOrganizationList({
      userMemberships: { infinite: true },
    });

  const memberships = useMemo(() => userMemberships?.data ?? [], [userMemberships]);
  const hasOrgs = memberships.length > 0;

  const [open, setOpen] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const rootRef = useRef<HTMLDivElement | null>(null);

  const activeName =
    (orgLoaded && organization?.name) ||
    (listLoaded && memberships[0]?.organization?.name) ||
    "No organization";

  // Auto-show create if user has no orgs
  useEffect(() => {
    if (!listLoaded) return;
    if (!hasOrgs) {
      setOpen(true);
      setShowCreate(true);
    }
  }, [listLoaded, hasOrgs]);

  // Click-outside close
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (!open) return;
      const el = rootRef.current;
      if (!el) return;
      if (e.target instanceof Node && !el.contains(e.target)) {
        setOpen(false);
        setShowCreate(false);
      }
    }
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open]);

  async function handleSelectOrg(orgId: string) {
    try {
      await setActive?.({ organization: orgId });
      setOpen(false);
      setShowCreate(false);
    } catch {
      // keep stable
    }
  }

  return (
    <SignedIn>
      <div ref={rootRef} className="relative">
        {/* Pill button: always shows name */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={clsx(
            "flex items-center gap-2 rounded-xl border px-3 py-2",
            "border-slate-800 bg-slate-900/60 hover:bg-slate-900",
            "text-slate-100 shadow-sm",
            "max-w-[260px]"
          )}
          aria-haspopup="menu"
          aria-expanded={open}
          title={activeName}
        >
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-slate-800 text-xs font-semibold text-slate-200">
            {String(activeName || "O").trim().slice(0, 1).toUpperCase()}
          </span>
          <span className="truncate text-sm font-medium">{activeName}</span>
          <span className="ml-1 text-slate-400">–¾</span>
        </button>

        {/* Dropdown */}
        {open ? (
          <div
            className={clsx(
              "absolute right-0 mt-2 w-[380px] max-w-[calc(100vw-16px)]",
              "rounded-2xl border shadow-2xl",
              "border-slate-800 bg-slate-950/95 backdrop-blur",
              "z-50"
            )}
            role="menu"
          >
            {/* Make the whole dropdown scroll if needed */}
            <div className="max-h-[72vh] overflow-y-auto px-4 py-3">
              <div className="text-xs font-semibold tracking-wide text-slate-400">
                Organization
              </div>

              {/* No-org banner */}
              {!hasOrgs ? (
                <div className="mt-3 rounded-xl border border-amber-500/25 bg-amber-500/10 p-3">
                  <div className="text-sm font-semibold text-amber-200">
                    No org yet
                  </div>
                  <div className="mt-1 text-xs text-amber-100/80">
                    Create one to unlock Vendors, Issues, and Board reporting.
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowCreate(true)}
                    className="mt-3 inline-flex w-full items-center justify-center rounded-lg bg-amber-500/20 px-3 py-2 text-sm font-semibold text-amber-100 hover:bg-amber-500/25"
                  >
                    Create organization
                  </button>
                </div>
              ) : null}

              {/* Org list */}
              {hasOrgs ? (
                <div className="mt-3 space-y-2">
                  {memberships.map((m: any) => {
                    const org = m?.organization;
                    const id = org?.id as string | undefined;
                    const name = (org?.name as string | undefined) || "Untitled";
                    const isActive = orgLoaded && organization?.id === id;

                    return (
                      <button
                        key={id || name}
                        type="button"
                        onClick={() => id && handleSelectOrg(id)}
                        className={clsx(
                          "w-full rounded-xl border px-3 py-2 text-left",
                          "border-slate-800 bg-slate-900/40 hover:bg-slate-900/70",
                          isActive && "ring-1 ring-sky-500/40"
                        )}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-slate-100">
                              {name}
                            </div>
                            <div className="truncate text-xs text-slate-400">
                              {isActive ? "Active" : "Switch to this org"}
                            </div>
                          </div>
                          <div className="text-xs text-slate-400">
                            {isActive ? "œ“" : ""}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : null}

              {/* Footer actions */}
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreate((v) => !v)}
                  className={clsx(
                    "flex-1 rounded-xl border px-3 py-2 text-sm font-semibold",
                    "border-slate-800 bg-slate-900/40 text-slate-100 hover:bg-slate-900/70"
                  )}
                >
                  {showCreate ? "Hide create" : "Create organization"}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    setShowCreate(false);
                  }}
                  className={clsx(
                    "rounded-xl border px-3 py-2 text-sm font-semibold",
                    "border-slate-800 bg-slate-900/40 text-slate-300 hover:bg-slate-900/70"
                  )}
                >
                  Close
                </button>
              </div>

              {/* Inline create panel */}
              {showCreate ? (
                <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-900/30 p-3">
                  <div className="mb-2 text-xs font-semibold tracking-wide text-slate-400">
                    Create Organization
                  </div>
                  <CreateOrganization
                    appearance={{
                      elements: {
                        card: "bg-transparent shadow-none border-0 p-0",
                        headerTitle: "text-slate-100",
                        headerSubtitle: "text-slate-400",
                        formFieldLabel: "text-slate-200",
                        formFieldInput:
                          "bg-slate-950/60 border-slate-700 text-slate-100",
                        formButtonPrimary:
                          "bg-sky-600 hover:bg-sky-500 text-white",
                      },
                    }}
                  />
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </SignedIn>
  );
}


