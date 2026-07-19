"use client";
export function useT(){
  try{
    // Lazy require so SSR/prerender won't choke if alias or context isn't ready.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const lib = require("@/lib/i18n");
    const ctx = typeof lib?.useI18n === "function" ? lib.useI18n() : null;
    if (ctx && typeof ctx.t === "function") return ctx.t;
  }catch{}
  return (k: string) => k;
}


