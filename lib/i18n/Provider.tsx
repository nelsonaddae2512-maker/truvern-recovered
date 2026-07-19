"use client";
import * as React from "react";

type Dict = Record<string, string>;

const dictionaries: Record<string, Dict> = {
  en: {
    "nav.features":"Features","nav.vendors":"Vendors","nav.buyers":"Buyers","nav.pricing":"Pricing",
    "nav.trust":"Trust Network","nav.directory":"Directory","nav.subscribe":"Subscribe","nav.login":"Login",
    "footer.tagline":"Verify once, share everywhere.","cta.startFree":"Start Free","cta.directory":"Browse Directory",
    "pricing.title":"Simple, global pricing","contact.title":"Contact us","contact.send":"Send"
  },
  es: {
    "nav.features":"Funciones","nav.vendors":"Vendedores","nav.buyers":"Compradores","nav.pricing":"Precios",
    "nav.trust":"Red de Confianza","nav.directory":"Directorio","nav.subscribe":"Suscribirse","nav.login":"Iniciar sesiÃ³n",
    "footer.tagline":"Verifica una vez, comparte en todas partes.","cta.startFree":"Comienza gratis","cta.directory":"Explorar directorio",
    "pricing.title":"Precios simples y globales","contact.title":"ContÃ¡ctanos","contact.send":"Enviar"
  },
  fr: {
    "nav.features":"FonctionnalitÃ©s","nav.vendors":"Fournisseurs","nav.buyers":"Acheteurs","nav.pricing":"Tarifs",
    "nav.trust":"RÃ©seau de confiance","nav.directory":"Annuaire","nav.subscribe":"S€™abonner","nav.login":"Connexion",
    "footer.tagline":"VÃ©rifiez une fois, partagez partout.","cta.startFree":"Commencer gratuitement","cta.directory":"Parcourir l€™annuaire",
    "pricing.title":"Tarification simple et mondiale","contact.title":"Nous contacter","contact.send":"Envoyer"
  },
  de: {
    "nav.features":"Funktionen","nav.vendors":"Anbieter","nav.buyers":"EinkÃ¤ufer","nav.pricing":"Preise",
    "nav.trust":"Trust-Netzwerk","nav.directory":"Verzeichnis","nav.subscribe":"Abonnieren","nav.login":"Anmelden",
    "footer.tagline":"Einmal verifizieren, Ã¼berall teilen.","cta.startFree":"Kostenlos starten","cta.directory":"Verzeichnis ansehen",
    "pricing.title":"Einfache, globale Preise","contact.title":"Kontakt","contact.send":"Senden"
  }
};

type I18nValue = {
  t: (k: string) => string;
  locale: string;
  setLocale: (l: string) => void;
};

const I18nContext = React.createContext<I18nValue>({
  t: (k) => k,
  locale: "en",
  setLocale: () => {}
});

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const initial =
    (typeof window !== "undefined" &&
      (new URLSearchParams(window.location.search).get("lang") ||
        localStorage.getItem("lang"))) ||
    "en";

  const [locale, setLocale] = React.useState<string>(initial);

  const t = React.useCallback(
    (k: string) => (dictionaries[locale] || dictionaries.en)[k] || dictionaries.en[k] || k,
    [locale]
  );

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("lang", locale);
    }
  }, [locale]);

  return (
    <I18nContext.Provider value={{ t, locale, setLocale }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return React.useContext(I18nContext);
}

/** Helper that returns the translator function. Always a function. */
export function useT() {
  return useI18n().t;
}





