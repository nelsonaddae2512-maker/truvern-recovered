
import React from 'react';
import Link from 'next/link';

export function Comparison(){
  const rows = [
    { feature:'Reusable Trust Profile', you:'œ“', others:'€”' },
    { feature:'Evidence-backed score', you:'œ“', others:'Limited' },
    { feature:'CISO override & disclosure caps', you:'œ“', others:'€”' },
    { feature:'Board Report PDF', you:'œ“', others:'Add-on' },
    { feature:'Public directory + badge', you:'œ“', others:'€”' },
    { feature:'Jira/Slack remediation', you:'œ“', others:'Limited' }
  ];
  return (
    <section className="px-6 py-12 md:py-16 bg-slate-50">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-2xl md:text-3xl font-bold">Why Truvern wins</h2>
        <p className="text-slate-600 mt-2">Comparable to GRC suites, faster to deploy, priced for scale.</p>
        <div className="mt-6 overflow-x-auto">
          <table className="min-w-[700px] w-full text-sm">
            <thead>
              <tr className="text-left">
                <th className="p-3 border-b">Feature</th>
                <th className="p-3 border-b">Truvern</th>
                <th className="p-3 border-b">Typical tools</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r=>(
                <tr key={r.feature} className="border-b">
                  <td className="p-3">{r.feature}</td>
                  <td className="p-3 font-semibold">{r.you}</td>
                  <td className="p-3">{r.others}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-6">
          <Link href="/pricing" className="h-11 px-5 rounded-xl bg-slate-900 text-white inline-flex items-center">See pricing</Link>
        </div>
      </div>
    </section>
  );
}




