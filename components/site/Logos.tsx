
import React from 'react';
export function Logos(){
  return (
    <section className="px-6 py-8 bg-slate-50 border-y">
      <div className="max-w-6xl mx-auto">
        <div className="text-xs uppercase tracking-wider text-slate-500 mb-4">Trusted by security-first teams</div>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-6 place-items-center">
          {Array.from({length:6}).map((_,i)=>(<div key={i} className="h-6 w-24 bg-slate-200 rounded" />))}
        </div>
      </div>
    </section>
  );
}



