import Link from "next/link";
import NewVendorForm from "@/components/new-vendor-form";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function NewVendorPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-12 text-white">
      <Link href="/vendors" className="text-sm font-semibold text-cyan-200 hover:text-cyan-100">
        ← Back to vendors
      </Link>

      <section className="mt-6 rounded-[2rem] border border-cyan-400/20 bg-cyan-500/10 p-8 shadow-2xl shadow-cyan-500/10">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-200">
          Vendor intake
        </p>

        <h1 className="mt-4 text-4xl font-black tracking-tight">
          Add a vendor.
        </h1>

        <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300">
          Create a vendor workspace, then request a Truvern Review when you are ready for Truvern to run the review flow.
        </p>
      </section>

      <section className="mt-8 rounded-3xl border border-white/10 bg-white/[0.04] p-6">
        <NewVendorForm />
      </section>
    </main>
  );
}

