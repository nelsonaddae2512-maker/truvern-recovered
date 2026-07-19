const attachments = [
  {
    name: "Vendor security questionnaire",
    type: "Assessment evidence",
    checksum: "sha256:7f2c9e4a1b8d...",
    timestamp: "Release snapshot",
  },
  {
    name: "SOC 2 / security attestation",
    type: "Certification artifact",
    checksum: "sha256:4a91de28bc10...",
    timestamp: "Release snapshot",
  },
  {
    name: "Reviewer evidence attestation",
    type: "Governance review",
    checksum: "sha256:b13a90fd442e...",
    timestamp: "Final reviewer approval",
  },
];

export default function PublicEvidenceManifest() {
  return (
    <section className="rounded-3xl border border-cyan-300/15 bg-slate-950/70 p-6 shadow-2xl shadow-cyan-950/20">
      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-200">
        Immutable attachment manifest
      </p>
      <h2 className="mt-2 text-2xl font-semibold text-white">
        Released evidence artifacts
      </h2>
      <p className="mt-2 max-w-3xl text-sm text-slate-300">
        Evidence listed here represents release-time attachment snapshots, including artifact checksums, release timestamps, and reviewer attestations.
      </p>

      <div className="mt-6 grid gap-3">
        {attachments.map((item) => (
          <div
            key={item.name}
            className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
          >
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="font-semibold text-white">{item.name}</div>
                <div className="mt-1 text-xs text-slate-400">{item.type}</div>
              </div>
              <div className="text-left lg:text-right">
                <code className="rounded-xl border border-white/10 bg-black/30 px-2 py-1 text-[11px] text-cyan-100">
                  {item.checksum}
                </code>
                <div className="mt-2 text-xs text-slate-500">{item.timestamp}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

