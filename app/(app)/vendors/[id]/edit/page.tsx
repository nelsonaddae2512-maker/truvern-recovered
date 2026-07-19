import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = {
  params: Promise<{ id: string }> | { id: string };
};

const tiers = ["CRITICAL", "IMPORTANT", "STANDARD"];
const criticalities = ["HIGH", "MEDIUM", "LOW"];

function parseId(v: unknown) {
  const n = Number(String(v ?? "").trim());
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

async function updateVendor(formData: FormData) {
  "use server";

  const id = parseId(formData.get("id"));
  if (!id) throw new Error("Invalid vendor id.");

  const name = String(formData.get("name") || "").trim();
  const category = String(formData.get("category") || "").trim();
  const tier = String(formData.get("tier") || "").trim();
  const criticality = String(formData.get("criticality") || "").trim();
  const contactName = String(formData.get("contactName") || "").trim();
  const contactEmail = String(formData.get("contactEmail") || "").trim();

  if (!name) throw new Error("Vendor name is required.");

  await prisma.vendor.update({
    where: { id },
    data: {
      name,
      category: category || null,
      tier: tier ? (tier as any) : null,
      criticality: criticality ? (criticality as any) : null,
      contactName: contactName || null,
      contactEmail: contactEmail || null,
    },
    select: { id: true },
  });

  redirect(`/vendors/${id}`);
}

async function deleteVendor(formData: FormData) {
  "use server";

  const id = parseId(formData.get("id"));
  if (!id) throw new Error("Invalid vendor id.");

  const vendor = await prisma.vendor.findUnique({
    where: { id },
    select: {
      id: true,
      _count: {
        select: {
          assessments: true,
          assessmentRuns: true,
        },
      },
    },
  });

  if (!vendor) throw new Error("Vendor not found.");

  if (vendor._count.assessments > 0 || vendor._count.assessmentRuns > 0) {
    throw new Error("This vendor has assessment history and cannot be deleted.");
  }

  await prisma.vendor.delete({
    where: { id },
    select: { id: true },
  });

  redirect("/vendors");
}

export default async function EditVendorPage({ params }: Props) {
  const resolvedParams = await params;
  const vendorId = parseId(resolvedParams.id);

  if (!vendorId) return notFound();

  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    select: {
      id: true,
      name: true,
      category: true,
      tier: true,
      criticality: true,
      contactName: true,
      contactEmail: true,
      _count: {
        select: {
          assessments: true,
          assessmentRuns: true,
        },
      },
    },
  });

  if (!vendor) return notFound();

  const canDelete =
    vendor._count.assessments === 0 && vendor._count.assessmentRuns === 0;

  return (
    <main className="mx-auto max-w-5xl px-6 py-10 text-white">
      <Link href={`/vendors/${vendor.id}`} className="text-sm text-cyan-200">
        ← Back to vendor
      </Link>

      <div className="mt-6">
        <p className="text-sm uppercase tracking-[0.35em] text-cyan-200">
          Edit vendor
        </p>

        <h1 className="mt-3 text-5xl font-semibold tracking-tight">
          {vendor.name}
        </h1>

        <p className="mt-4 max-w-2xl text-slate-300">
          Update vendor profile, tier, criticality, and primary contact details.
        </p>
      </div>

      <form
        action={updateVendor}
        className="mt-8 rounded-[2rem] border border-white/10 bg-white/[0.04] p-8"
      >
        <input type="hidden" name="id" value={vendor.id} />

        <div className="grid gap-6 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="text-sm font-medium text-slate-200">
              Vendor name
            </label>
            <input
              name="name"
              required
              defaultValue={vendor.name}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-4 text-white outline-none focus:border-cyan-400/40"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-200">
              Category
            </label>
            <input
              name="category"
              defaultValue={vendor.category || ""}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-4 text-white outline-none focus:border-cyan-400/40"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-200">
              Vendor tier
            </label>
            <select
              name="tier"
              defaultValue={vendor.tier || "STANDARD"}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-4 text-white outline-none focus:border-cyan-400/40"
            >
              {tiers.map((tier) => (
                <option key={tier} value={tier}>
                  {tier}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-200">
              Criticality
            </label>
            <select
              name="criticality"
              defaultValue={vendor.criticality || "MEDIUM"}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-4 text-white outline-none focus:border-cyan-400/40"
            >
              {criticalities.map((criticality) => (
                <option key={criticality} value={criticality}>
                  {criticality}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-200">
              Primary contact name
            </label>
            <input
              name="contactName"
              defaultValue={vendor.contactName || ""}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-4 text-white outline-none focus:border-cyan-400/40"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-200">
              Primary contact email
            </label>
            <input
              name="contactEmail"
              type="email"
              defaultValue={vendor.contactEmail || ""}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-4 text-white outline-none focus:border-cyan-400/40"
            />
          </div>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <button
            type="submit"
            className="rounded-full bg-cyan-300 px-7 py-4 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
          >
            Save changes
          </button>

          <Link
            href={`/vendors/${vendor.id}`}
            className="rounded-full border border-white/15 px-7 py-4 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            Cancel
          </Link>
        </div>
      </form>

      <section className="mt-8 rounded-[2rem] border border-rose-400/20 bg-rose-400/10 p-8">
        <p className="text-xs uppercase tracking-[0.3em] text-rose-100">
          Danger zone
        </p>

        <h2 className="mt-3 text-2xl font-semibold">Delete vendor</h2>

        <p className="mt-3 max-w-3xl text-sm leading-7 text-rose-100/80">
          Vendors can only be deleted before assessment history exists.
        </p>

        {canDelete ? (
          <form action={deleteVendor} className="mt-6">
            <input type="hidden" name="id" value={vendor.id} />
            <button
              type="submit"
              className="rounded-full border border-rose-300/40 bg-rose-400/20 px-6 py-3 text-sm font-semibold text-rose-50 transition hover:bg-rose-400/30"
            >
              Delete vendor
            </button>
          </form>
        ) : (
          <div className="mt-6 rounded-2xl border border-white/10 bg-slate-950/40 p-4 text-sm text-slate-300">
            Deletion disabled because this vendor has assessment history.
          </div>
        )}
      </section>
    </main>
  );
}




