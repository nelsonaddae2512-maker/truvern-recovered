"use client";

export default function VendorPortalCopyButton({ path }: { path: string }) {
  async function copy() {
    const url = `${window.location.origin}${path}`;
    await navigator.clipboard.writeText(url);
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="rounded-full border border-white/15 px-5 py-2 text-xs font-semibold text-white transition hover:bg-white/10"
    >
      Copy link
    </button>
  );
}

