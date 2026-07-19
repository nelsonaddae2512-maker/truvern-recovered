import Link from "next/link";
import { verifySignedGovernanceManifest } from "@/lib/governance/manifest";
import prisma from "@/lib/prisma";
import ReceiptQr from "@/components/governance/receipt-qr.client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = {
  params: Promise<{ receiptId: string }> | { receiptId: string };
};

type AnyRow = Record<string, any>;

function safeStr(v: unknown) {
  if (typeof v === "string") return v.trim();

  if (v instanceof Date) return v.toISOString();

  return "";
}

async function getVerification(assignmentId: string | number) {
  try {
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      "http://localhost:3000";

    const response = await fetch(
      `${baseUrl}/api/governance/verify/${assignmentId}`,
      {
        cache: "no-store",
      },
    );

    return await response.json();
  } catch {
    return null;
  }
}

async function getInclusionProof(receiptId: string) {
  try {
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      "http://localhost:3000";

    const response = await fetch(
      `${baseUrl}/api/governance/proofs/${encodeURIComponent(receiptId)}`,
      { cache: "no-store" },
    );

    return await response.json();
  } catch {
    return null;
  }
}

async function getReceipt(receiptId: string) {
  try {
    const rows: AnyRow[] = await prisma.$queryRawUnsafe(
      `
      select
        id,
        "entryId",
        "assignmentId",
        "responseId",
        checksum,
        "ledgerHash",
        "receiptId",
        timestamp,
        "previousEntryHash",
        "entryHash",
        "createdAt"
      from "GovernanceTransparencyLog"
      where "receiptId" = $1
      limit 1
      `,
      receiptId,
    );

    const entry = rows?.[0] || null;

    return {
      ok: !!entry,
      found: !!entry,
      receiptId,
      entry,
    };
  } catch {
    return null;
  }
}

export default async function ReceiptProofPage({ params }: Props) {
  const resolved = await params;
  const receiptId = safeStr(resolved?.receiptId);
  const data = receiptId ? await getReceipt(receiptId) : null;
  const entry: AnyRow | null = data?.entry || null;
  const verified = !!data?.found && !!entry?.entryHash && !!entry?.checksum;

  

  const verification = entry?.assignmentId
    ? await getVerification(entry.assignmentId)
    : null;

  const cryptographicallyVerified =
    !!verification?.attestation?.cryptographicallyVerified;

  const payloadHashMatches =
    verification?.attestation?.payloadHashMatches;

  const publicKeyFingerprint =
    verification?.attestation?.publicKeyFingerprint || null;

  const signatureKeyId =
    verification?.release?.keyId || null;

  const signedAt =
    verification?.release?.signedAt || null;

  const inclusionProof = receiptId
    ? await getInclusionProof(receiptId)
    : null;

  const inclusionVerified =
    !!inclusionProof?.inclusionVerified;

  const merkleRoot =
    inclusionProof?.merkleRoot || null;
return (
    <main className="min-h-screen bg-[#020617] text-white">
      <div className="mx-auto max-w-5xl px-6 py-16">
        <Link href="/transparency" className="text-sm text-cyan-200 hover:text-cyan-100">
          ← Transparency ledger
        </Link>

        <div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.03] p-8">
          <p
            className={`inline-flex rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] ${
              verified
                ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
                : "border-rose-400/30 bg-rose-500/10 text-rose-200"
            }`}
          >
            {verified ? "Verification passed" : "Verification failed"}
          </p>

          <h1 className="mt-6 text-4xl font-semibold tracking-tight">
            Governance receipt proof
          </h1>

          <p className="mt-4 text-slate-300">
            Public verification record for a notarized Truvern governance release.
          </p>
       
          <div className="mt-8 flex justify-center">
  <ReceiptQr
    value={`http://localhost:3000/verify/${encodeURIComponent(receiptId)}`}
  />
</div>

          <div className="mt-8 grid gap-5 md:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
                Receipt ID
              </p>
              <p className="mt-3 break-all font-mono text-sm text-white">
                {receiptId || "Unavailable"}
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
                Status
              </p>
              <p className="mt-3 text-sm font-semibold text-white">
                {verified ? "Found in transparency ledger" : "Not found"}
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
                Entry ID
              </p>
              <p className="mt-3 break-all font-mono text-sm text-white">
                {safeStr(entry?.entryId) || "Unavailable"}
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
                Notarized timestamp
              </p>
              <p className="mt-3 text-sm text-white">
                {safeStr(entry?.timestamp) || "Unavailable"}
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 p-5 md:col-span-2">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
                Checksum
              </p>
              <p className="mt-3 break-all font-mono text-sm text-white">
                {safeStr(entry?.checksum) || "Unavailable"}
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 p-5 md:col-span-2">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
                Entry hash
              </p>
              <p className="mt-3 break-all font-mono text-sm text-white">
                {safeStr(entry?.entryHash) || "Unavailable"}
              </p>
            </div>

                        <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/[0.06] p-5">
              <p className="text-xs uppercase tracking-[0.3em] text-cyan-300">
                Cryptographic verification
              </p>

              <p className={`mt-3 text-sm font-semibold ${
                cryptographicallyVerified
                  ? "text-emerald-300"
                  : "text-rose-300"
              }`}>
                {cryptographicallyVerified
                  ? "Signature verified"
                  : "Verification unavailable"}
              </p>
            </div>

            <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/[0.06] p-5">
              <p className="text-xs uppercase tracking-[0.3em] text-cyan-300">
                Payload integrity
              </p>

              <p className={`mt-3 text-sm font-semibold ${
                payloadHashMatches
                  ? "text-emerald-300"
                  : "text-rose-300"
              }`}>
                {payloadHashMatches
                  ? "Payload hash matched"
                  : "Payload hash mismatch"}
              </p>
            </div>

            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.06] p-5">
              <p className="text-xs uppercase tracking-[0.3em] text-emerald-300">
                Merkle inclusion proof
              </p>

              <p className={`mt-3 text-sm font-semibold ${
                inclusionVerified
                  ? "text-emerald-300"
                  : "text-rose-300"
              }`}>
                {inclusionVerified
                  ? "Included in signed daily root"
                  : "Inclusion proof unavailable"}
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
                Daily Merkle root
              </p>

              <p className="mt-3 break-all font-mono text-sm text-white">
                {merkleRoot || "Unavailable"}
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 p-5 md:col-span-2">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
                Public key fingerprint
              </p>

              <p className="mt-3 break-all font-mono text-sm text-white">
                {publicKeyFingerprint || "Unavailable"}
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
                Signature key ID
              </p>

              <p className="mt-3 break-all font-mono text-sm text-white">
                {safeStr(signatureKeyId) || "Unavailable"}
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
                Signed at
              </p>

              <p className="mt-3 text-sm text-white">
                {safeStr(signedAt) || "Unavailable"}
              </p>
            </div>

<div className="rounded-2xl border border-white/10 bg-black/20 p-5 md:col-span-2">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
                Previous entry hash
              </p>
              <p className="mt-3 break-all font-mono text-sm text-white">
                {safeStr(entry?.previousEntryHash) || "Genesis entry"}
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}










