
'use client';
import React from 'react';
import { useI18n } from "../../lib/i18n";

export function LanguageSwitcher(){
  const { locale, setLocale } = useI18n();
  return (
    <select aria-label="Language" className="border rounded px-2 py-1 text-sm" value={locale} onChange={e=>setLocale(e.target.value)}>
      <option value="en">EN</option>
      <option value="es">ES</option>
      <option value="fr">FR</option>
      <option value="de">DE</option>
    </select>
  );
}



