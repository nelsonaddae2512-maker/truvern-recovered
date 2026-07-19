type Dict = Record<string, string>;

const dictionaries: Record<string, Dict> = {
  en: {
    "nav.features":"Features","nav.vendors":"Vendors","nav.buyers":"Buyers","nav.pricing":"Pricing","nav.trust":"Trust Network","nav.directory":"Directory","nav.subscribe":"Subscribe","nav.login":"Login","footer.tagline":"Verify once, share everywhere.","cta.startFree":"Start Free","cta.directory":"Browse Directory","pricing.title":"Simple, global pricing","contact.title":"Contact us","contact.send":"Send"
  }
};

export function tServer(key: string, locale: string = "en"): string {
  const dict = dictionaries[locale] || dictionaries.en;
  return dict[key] || key;
}




