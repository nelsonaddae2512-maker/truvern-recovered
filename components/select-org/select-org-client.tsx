"use client";

import {
  ClerkLoaded,
  ClerkLoading,
  OrganizationSwitcher,
  SignedIn,
  SignedOut,
  SignInButton,
} from "@clerk/nextjs";
import { useSearchParams } from "next/navigation";

function clsx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export default function SelectOrgClient() {
  const sp = useSearchParams();
  const returnTo = sp.get("returnTo") || "/vendors";

  return (
    <div className="space-y-4">
      <ClerkLoading>
        <div className="rounded-2xl border border-slate-800/70 bg-slate-950/35 p-4">
          <div className="h-4 w-32 rounded bg-white/5" />
          <div className="mt-3 h-10 w-full rounded-md bg-white/5" />
          <div className="mt-3 h-3 w-72 rounded bg-white/5" />
        </div>
      </ClerkLoading>

      <ClerkLoaded>
        <SignedOut>
          <SignInButton mode="modal" forceRedirectUrl={returnTo}>
            <button className="rounded-xl border border-slate-800 bg-slate-900/30 px-3 py-2 text-sm text-slate-100 hover:bg-slate-900/60">
              Sign in to continue
            </button>
          </SignInButton>
        </SignedOut>

        <SignedIn>
          <div className="rounded-2xl border border-slate-800/70 bg-slate-950/35 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-white">
                  Organization
                </div>
                <div className="mt-1 text-xs text-slate-400">
                  Choose an organization to continue.
                </div>
              </div>

              <div className="rounded-lg bg-emerald-500/10 px-2 py-1 text-[11px] font-semibold text-emerald-100 ring-1 ring-emerald-400/20">
                No org yet? Create one
              </div>
            </div>

            <div className="mt-3">
              <OrganizationSwitcher
                hidePersonal
                afterCreateOrganizationUrl={returnTo}
                afterLeaveOrganizationUrl="/select-org"
                afterSelectOrganizationUrl={returnTo}
                appearance={{
                  elements: {
                    rootBox: "w-full",
                    organizationSwitcherTrigger:
                      "h-10 w-full justify-between rounded-md bg-white/5 px-3 text-slate-100 ring-1 ring-white/10 hover:bg-white/10",
                    organizationPreviewTextContainer: "max-w-[220px]",
                    organizationPreviewMainIdentifier:
                      "text-sm text-slate-100",
                    organizationPreviewSecondaryIdentifier:
                      "text-xs text-slate-400",
                    organizationSwitcherTriggerIcon: "text-slate-300",
                    organizationSwitcherPopoverCard:
                      "border border-white/10 bg-slate-950 text-slate-100 shadow-2xl",
                    organizationSwitcherPopoverActionButton:
                      "text-slate-100 hover:bg-white/5",
                    organizationSwitcherPopoverActionButtonText:
                      "text-slate-200",
                  },
                }}
              />
            </div>

            <div className="mt-3 text-xs text-slate-400">
              Tip: open the switcher and choose{" "}
              <span className="text-slate-200">Create organization</span> if you
              don€™t see one listed.
            </div>

            <div className="mt-3 text-[11px] text-slate-500">
              You€™ll be redirected to{" "}
              <span className="text-slate-300">{returnTo}</span> after selecting
              or creating an organization.
            </div>
          </div>
        </SignedIn>
      </ClerkLoaded>
    </div>
  );
}


