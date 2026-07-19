// lib/org-guard.ts
"use client";

import { useMemo } from "react";
import { useAuth, useOrganization } from "@clerk/nextjs";

/**
 * Client-side org guard utilities.
 *
 * IMPORTANT:
 * - This file should NOT force navigation (router.replace/push) as a side-effect.
 * - It should expose state so *pages* can decide what to do.
 */

export type ClientOrgState =
  | { ready: false; orgId: null }
  | { ready: true; orgId: string | null };

export function useClientOrgState(): ClientOrgState {
  const { isLoaded: authLoaded, orgId } = useAuth();
  const { isLoaded: orgLoaded } = useOrganization();

  const ready = Boolean(authLoaded && orgLoaded);

  return useMemo(() => {
    if (!ready) return { ready: false, orgId: null };
    return { ready: true, orgId: typeof orgId === "string" ? orgId : null };
  }, [ready, orgId]);
}

/**
 * Convenience helper for UI: tells you if the user needs to pick an org.
 */
export function useNeedsOrgSelection(): boolean {
  const s = useClientOrgState();
  return s.ready && !s.orgId;
}



