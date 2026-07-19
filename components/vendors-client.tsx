// components/vendors-client.tsx  (CLIENT COMPONENT)
"use client";

export default function VendorsClient({ vendors }: { vendors: any[] }) {
  return (
    <main className="container-page py-10">
      {/* render vendors here */}
      <pre className="text-xs text-slate-200/70">
        {JSON.stringify(vendors, null, 2)}
      </pre>
    </main>
  );
}

