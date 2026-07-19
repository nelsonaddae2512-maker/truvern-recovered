import Link from "next/link";
import prisma from "@/lib/prisma";
import AssessmentPortalControls from "@/components/assessments/assessment-portal-controls.client";

type Props = {
  vendorId: number;
};

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "Not recorded";

  try {
    return new Intl.DateTimeFormat("en", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(value));
  } catch {
    return "Not recorded";
  }
}

function statusTone(status: string | null | undefined) {
  const normalized = String(status || "").toUpperCase();

  if (["SUBMITTED", "REVIEW_READY"].includes(normalized)) {
    return "border-cyan-300/20 bg-cyan-400/10 text-cyan-100";
  }

  if (["COMPLETED", "RELEASED", "CONFIRMED"].includes(normalized)) {
    return "border-emerald-300/20 bg-emerald-400/10 text-emerald-100";
  }

  if (["LAUNCHED", "IN_PROGRESS", "DRAFT"].includes(normalized)) {
    return "border-amber-300/20 bg-amber-400/10 text-amber-100";
  }

  return "border-white/10 bg-white/[0.04] text-slate-300";
}

export default async function VendorPortalAccessPanel({ vendorId }: Props) {
  const assessments = await prisma.assessment.findMany({
    where: {
      vendorId,
      token: {
        not: null,
      },
    },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    take: 8,
    select: {
      id: true,
      title: true,
      token: true,
      status: true,
      vendorEmail: true,
      launchedAt: true,
      submittedAt: true,
      completedAt: true,
      updatedAt: true,
    },
  });

  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-cyan-200">
            Vendor portal links
          </p>

          <h2 className="mt-3 text-2xl font-semibold text-white">
            Sent vendor links
          </h2>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
            View, copy, or reopen vendor review portals that have already
            been generated for this vendor.
          </p>
        </div>

        <Link
          href={`/vendors/${vendorId}`}
          className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-slate-200 hover:bg-white/[0.08]"
        >
          Vendor profile
        </Link>
      </div>

      {assessments.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-white/10 bg-slate-950/40 p-5 text-sm text-slate-400">
          No vendor portal links have been generated yet. Launch or send a vendor review to create a persistent vendor token.
        </div>
      ) : (
        <div className="mt-6 grid gap-4">
          {assessments.map((assessment) => {
            const vendorPath = `/vendor-assessment/${assessment.token}`;
            const launchPath = `/assessments/${assessment.id}/launch`;

            return (
              <article
                key={assessment.id}
                className="rounded-2xl border border-white/10 bg-slate-950/40 p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold text-white">
                        {assessment.title || `Assessment #${assessment.id}`}
                      </h3>

                      <span
                        className={`rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] ${statusTone(
                          String(assessment.status || ""),
                        )}`}
                      >
                        {String(assessment.status || "UNKNOWN").replaceAll("_", " ")}
                      </span>
                    </div>

                    <div className="mt-3 grid gap-2 text-sm text-slate-400 sm:grid-cols-2 lg:grid-cols-4">
                      <span>Assessment #{assessment.id}</span>
                      <span>
                        Sent to {assessment.vendorEmail || "vendor portal link generated"}
                      </span>
                      <span>Launched {formatDate(assessment.launchedAt)}</span>
                      <span>Updated {formatDate(assessment.updatedAt)}</span>
                    </div>
                  </div>

                                    <div className="flex flex-wrap gap-2">
                    <Link
                      href={vendorPath}
                      target="_blank"
                      className="rounded-2xl border border-cyan-300/20 bg-cyan-400/10 px-4 py-3 text-sm font-semibold text-cyan-50 hover:bg-cyan-400/15"
                    >
                      Open vendor portal
                    </Link>

                    <Link
                      href={launchPath}
                      className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-white hover:bg-white/[0.08]"
                    >
                      Open launch page
                    </Link>
                    <AssessmentPortalControls assessmentId={assessment.id} />
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}






