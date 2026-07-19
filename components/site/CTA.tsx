'use client';
export const dynamic = 'force-dynamic';

import React from 'react';
import Link from 'next/link';
import { useI18n } from "@/lib/i18n/client";
export function CTA(){
  const { t, locale, setLocale } = useI18n();
  return (
    <section className="px-6 py-12 md:py-16">
      <div className="max-w-6xl mx-auto border rounded-2xl p-8 text-center">
        <h3 className="text-2xl md:text-3xl font-bold">{'Ready to publish your Trust Profile?'}</h3>
        <p className="text-slate-600 mt-2">Create once, share with every buyer. Evidence-backed trust, globally.</p>
        <div className="mt-6 flex gap-3 justify-center">
          <Link href="/subscribe" className="h-11 px-5 rounded-xl bg-slate-900 text-white font-medium">{t('cta.startFree')}</Link>
          <Link href="/trust" className="h-11 px-5 rounded-xl border font-medium">{t('cta.directory')}</Link>
        </div>
        <div className="mt-4 text-xs text-slate-500">
          <span>Language:</span>
          <select className="ml-2 border rounded px-2 py-1" value={locale} onChange={e=>setLocale(e.target.value)}>
            <option value="en">English</option>
            <option value="es">EspaÃƒÆ’Ã†€™Ãƒ€šÃ‚±ol</option>
            <option value="fr">FranÃƒÆ’Ã†€™Ãƒ€šÃ‚§ais</option>
          </select>
        </div>
      </div>
    </section>
  );
}





