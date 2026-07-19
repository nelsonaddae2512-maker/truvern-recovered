"use client";
import React from "react";

type Dict = Record<string, string>;

const dictionaries: Record<string, Dict> = {
  en: {
    "nav.features":"Features","nav.vendors":"Vendors","nav.buyers":"Buyers","nav.pricing":"Pricing","nav.trust":"Trust Network","nav.directory":"Directory","nav.subscribe":"Subscribe","nav.login":"Login","footer.tagline":"Verify once, share everywhere.","cta.startFree":"Start Free","cta.directory":"Browse Directory","pricing.title":"Simple, global pricing","contact.title":"Contact us","contact.send":"Send"
  }
};

type Ctx = { t:(k:string)=>string; locale:string; setLocale:(l:string)=>void };
const I18nContext = React.createContext<Ctx>({
  t:(k)=>dictionaries.en[k] || k,
  locale:"en",
  setLocale: ()=>{}
});

export function I18nProvider({children}:{children:React.ReactNode}){
  const initial = (typeof window!=="undefined" && (new URLSearchParams(window.location.search).get("lang") || localStorage.getItem("lang"))) || "en";
  const [locale, setLocale] = React.useState<string>(initial);
  const t = React.useCallback((k:string)=> (dictionaries[locale]||dictionaries.en)[k] || dictionaries.en[k] || k, [locale]);
  React.useEffect(()=>{ try{ if(typeof window!=="undefined"){ localStorage.setItem("lang", locale); } }catch{} }, [locale]);
  return <I18nContext.Provider value={{ t, locale, setLocale }}>{children}</I18nContext.Provider>;
}

export function useI18n(){ return React.useContext(I18nContext); }




