import Link from "next/link";
import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import VendorPortalAccessPanel from "@/components/vendors/vendor-portal-access-panel";
import AssessmentStartChooser from "@/components/assessment-start-chooser";
import { getCurrentOrgPlanTier } from "@/lib/billing/plan-access";
import NewEvidenceRequestForm from "@/components/evidence/new-evidence-request-form";
import VendorEvidenceRepository from "@/components/vendors/vendor-evidence-repository";
import SendToReviewDeskButton from "@/components/vendors/send-to-review-desk-button.client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = {
  params: Promise<{ id: string }> | { id: string };
};

const DATA_ELEMENTS = [
  "Customer PII",
  "Financial records",
  "Healthcare data",
  "Internal business systems",
  "Production infrastructure",
  "Source code access",
  "SSO / Identity integration",
  "Payment processing",
];

function parseId(v: unknown) {
  const n = Number(String(v ?? "").trim());
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

function riskTone(score: number | null) {
  if (score === null) return "text-slate-300 border-white/10 bg-white/5";
  if (score >= 75) return "text-rose-200 border-rose-400/30 bg-rose-400/10";
  if (score >= 45) return "text-amber-200 border-amber-400/30 bg-amber-400/10";
  return "text-emerald-200 border-emerald-400/30 bg-emerald-400/10";
}

function riskLabel(score: number | null) {
  if (score === null) return "Unscored";
  if (score >= 75) return "High risk";
  if (score >= 45) return "Medium risk";
  return "Low risk";
}

function recommendedFrameworks(category?: string | null) {
  const normalized = (category || "").toLowerCase();

  if (normalized.includes("finance")) return ["SIG", "SOC 2", "PCI DSS"];
  if (normalized.includes("health")) return ["HIPAA", "HITRUST", "SOC 2"];
  if (normalized.includes("cloud")) return ["CAIQ", "SOC 2", "ISO 27001"];

  return ["Truvern Baseline", "SIG Lite", "SOC 2"];
}

export default async function VendorDetailPage({ params }: Props) {
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
      status: true,
      riskScore: true,
      updatedAt: true,

      _count: {
        select: {
          evidence: true,
          assessments: true,
          issues: true,
          evidenceRequests: true,
        },
      },
    },
  });

  if (!vendor) return notFound();

  const vendorContacts = await prisma.$queryRawUnsafe<
    Array<{
      id: number;
      name: string | null;
      email: string;
      role: string | null;
      phone: string | null;
      isPrimary: boolean;
    }>
  >(
    `select id, name, email, role, phone, "isPrimary"
     from "VendorContact"
     where "vendorId" = $1
     order by "isPrimary" desc, "createdAt" asc, id asc`,
    vendor.id,
  );

  const templates = await prisma.$queryRawUnsafe<
    Array<{
      id: number;
      name: string;
      description: string | null;
      standard: string | null;
      category: string | null;
      version: string | null;
      isActive: boolean;
      accessTier: string | null;
      source: string | null;
      origin: string | null;
      isSystem: boolean | null;
      isFeatured: boolean | null;
      sectionCount: number;
      questionCount: number;
      sections: any[];
    }>
  >(
    `
    select
      t.id,
      t.name,
      t.description,
      t.standard,
      t.category,
      t.version,
      t."isActive",
      t."accessTier"::text as "accessTier",
      t.source::text as source,
      t.origin::text as origin,
      t."isSystem",
      t."isFeatured",
      (
        select count(*)::int
        from "AssessmentSection" s
        where s."templateId" = t.id
      ) as "sectionCount",
      (
        select count(*)::int
        from "AssessmentQuestion" q
        where q."templateId" = t.id
      ) as "questionCount",
      coalesce(
        (
          select jsonb_agg(section_row order by (section_row->>'order')::int, (section_row->>'id')::int)
          from (
            select jsonb_build_object(
              'id', s.id,
              'title', s.title,
              'description', s.description,
              'order', s."order",
              'questions',
                coalesce(
                  (
                    select jsonb_agg(
                      jsonb_build_object(
                        'id', q.id,
                        'text', q.text,
                        'type', q.type::text,
                        'required', q.required
                      )
                      order by q."orderIndex" asc, q.id asc
                    )
                    from "AssessmentQuestion" q
                    where q."sectionId" = s.id
                    limit 4
                  ),
                  '[]'::jsonb
                )
            ) as section_row
            from "AssessmentSection" s
            where s."templateId" = t.id
            order by s."order" asc, s.id asc
            limit 4
          ) x
        ),
        '[]'::jsonb
      ) as sections
    from "AssessmentTemplate" t
    where t."isActive" = true
    order by
      t."isFeatured" desc,
      case t."accessTier"::text
        when 'FREE' then 1
        when 'PRO' then 2
        when 'ENTERPRISE' then 3
        else 4
      end asc,
      t."updatedAt" desc,
      t.id desc
    limit 50
    `,
  );

  const membershipTier = await getCurrentOrgPlanTier();

  const activeAssessmentCount = await prisma.$queryRawUnsafe<Array<{ count: number }>>(`
    select count(*)::int as count
    from "AssessmentRun"
    where "vendorId" = ${vendor.id}
      and status::text in ('SUBMITTED', 'COMPLETED', 'REVIEWED', 'RELEASED', 'CONFIRMED')
  `);

  const activeAssessments =
    Number(activeAssessmentCount?.[0]?.count || 0);


  const assessmentRegistryRows = await prisma.$queryRawUnsafe<
    Array<{
      assignmentId: number | null;
      assessmentRunId: number | null;
      status: string | null;
      assignmentType: string | null;
      releaseState: string | null;
      intent: string | null;
      riskLevel: string | null;
      decision: string | null;
      reviewerUserId: string | null;
      reviewerName: string | null;
      createdAt: Date | string | null;
      updatedAt: Date | string | null;
      releasedAt: string | null;
      confirmedAt: string | null;
      checksum: string | null;
      manifestId: number | null;
    }>
  >(
    `
    select
      ra.id::int as "assignmentId",
      null::int as "assessmentRunId",
      ra.status::text as status,
      ra."assignmentType"::text as "assignmentType",
      coalesce(resp.responses->>'releaseState', '') as "releaseState",
      coalesce(resp.responses->>'intent', '') as intent,
      coalesce(resp.responses->>'riskLevel', resp.responses->'governanceReleaseSnapshot'->>'riskLevel') as "riskLevel",
      coalesce(resp.responses->>'decision', resp.responses->'governanceReleaseSnapshot'->>'decision') as decision,
      ra."reviewerUserId",
      ra."reviewerName",
      ra."createdAt",
      ra."updatedAt",
      coalesce(resp.responses->>'releasedAt', resp.responses->'governanceReleaseSnapshot'->>'releasedAt') as "releasedAt",
      coalesce(resp.responses->>'confirmedAt', resp.responses->'governanceReleaseSnapshot'->>'confirmedAt') as "confirmedAt",
      coalesce(resp.responses->'governanceSeal'->>'checksum', resp.responses->'governanceReleaseSnapshot'->'governanceSeal'->>'checksum') as checksum,
      gm.id::int as "manifestId"
    from "ReviewAssignment" ra
    left join "ReviewRequest" rr on rr.id = ra."reviewRequestId"
    left join lateral (
      select r.id, r.responses, r."updatedAt"
      from "ReviewResponse" r
      where r."reviewAssignmentId" = ra.id
      order by r."updatedAt" desc, r.id desc
      limit 1
    ) resp on true
    left join "GovernanceReleaseManifest" gm on gm."reviewResponseId" = resp.id
    where coalesce(rr."vendorId", ra."vendorId") = $1
    order by ra."updatedAt" desc, ra.id desc
    limit 50
    `,
    vendor.id,
  );
  const score =
    typeof vendor.riskScore === "number" ? vendor.riskScore : null;

  const frameworks = recommendedFrameworks(vendor.category);

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
            <section className="mb-8 rounded-[2rem] border border-cyan-400/20 bg-cyan-500/10 p-6 shadow-2xl shadow-cyan-500/10">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-200">
              Vendor Governance Workspace
            </div>

            <h2 className="mt-3 text-2xl font-black tracking-tight text-white">
              Manage this vendor assessments, releases, evidence, and governance history.
            </h2>

            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
              Review all assessment activity, launch managed reviews, inspect immutable
              release packets, track evidence, and maintain this vendor long-term
              governance record.
            </p>
          </div>

          <Link
            href={`/vendors/${vendor.id}/managed-review`}
            className="inline-flex shrink-0 items-center justify-center rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
          >
            Start Managed Review
          </Link>
        </div>
      </section>
<Link href="/vendors" className="text-sm text-cyan-200">
        ← Back to vendors
      </Link>

      
      <section className="mt-6 rounded-3xl border border-white/10 bg-white/[0.03] p-4">
        <div className="flex flex-wrap gap-3">
          {[
            ["overview", "Overview"],
            ["reviews", "Assessment Registry"],
            ["release-archive", "Release Archive"],
            ["governance-context", "Governance Context"],
            ["portal-access", "Portal Access"],
            ["start-assessment", "Assessment Launch"],
            ["evidence-requests", "Evidence"],
          ].map(([href, label]) => (
            <a
              key={href}
              href={`#${href}`}
              className="rounded-full border border-white/10 bg-slate-950/40 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-cyan-300/30 hover:bg-cyan-400/10 hover:text-cyan-100"
            >
              {label}
            </a>
          ))}
        </div>
      </section>
<div id="overview" className="mt-6 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.35em] text-cyan-200">
            Vendor profile
          </p>

          <h1 className="mt-3 text-5xl font-semibold text-white">
            {vendor.name}
          </h1>

          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-slate-300">
            <span>Vendor #{vendor.id}</span>
            <span>•</span>
            <span>{vendor.category || "General vendor"}</span>
            <span>•</span>
            <span>Updated {vendor.updatedAt.toLocaleDateString()}</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href={`/vendors/${vendor.id}/edit`}
            className="rounded-full border border-white/15 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            Edit vendor
          </Link>

          <div
            className={`rounded-full border px-5 py-3 text-sm ${riskTone(score)}`}
          >
            {riskLabel(score)}
          </div>

          <div className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-5 py-3 text-sm text-cyan-100">
            Governance workspace
          </div>
        </div>
      </div>

      <div className="mt-8 grid gap-5 md:grid-cols-4">
        <Metric label="Evidence" value={vendor._count.evidence} />
        <Metric label="Requests" value={vendor._count.evidenceRequests} />
        <Metric label="Reviewable assessments" value={activeAssessments} />
        <Metric label="Issues" value={vendor._count.issues} />
      </div>

      <section id="governance-context" className="mt-8 grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-cyan-200">
                Vendor contacts
              </p>

              <h2 className="mt-3 text-3xl font-semibold text-white">
                Governance stakeholders
              </h2>

              <p className="mt-4 leading-8 text-slate-300">
                Operational and governance contacts associated with this vendor.
              </p>
            </div>

            <div className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-xs text-cyan-100">
              {vendorContacts.length} contacts
            </div>
          </div>

          <div className="mt-8 space-y-4">
            {vendorContacts.length > 0 ? (
              vendorContacts.map((contact) => (
                <ContactCard
                  key={contact.id}
                  name={contact.name || "Vendor contact"}
                  role={contact.role || "Vendor contact"}
                  email={contact.email}
                  phone={contact.phone || ""}
                  isPrimary={contact.isPrimary}
                />
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-5 text-sm text-slate-400">
                No contacts saved yet.
              </div>
            )}
          </div>

          <form
            action={`/api/vendors/${vendor.id}/contacts`}
            method="POST"
            className="mt-8 rounded-3xl border border-white/10 bg-slate-950/40 p-5"
          >
            <p className="text-xs uppercase tracking-[0.25em] text-slate-500">
              Add vendor contact
            </p>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <input
                name="name"
                placeholder="Full name"
                className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none"
              />

              <input
                name="email"
                type="email"
                placeholder="Email address"
                className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none"
              />

              <input
                name="role"
                placeholder="Role (Security, Legal, IT...)"
                className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none"
              />

              <input
                name="phone"
                placeholder="Phone"
                className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none"
              />
            </div>

            <label className="mt-5 flex items-center gap-3 text-sm text-slate-300">
              <input type="checkbox" name="isPrimary" />
              Set as primary vendor contact
            </label>

            <button
              type="submit"
              className="mt-6 rounded-2xl bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950"
            >
              Save contact
            </button>
          </form>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-7">
          <p className="text-xs uppercase tracking-[0.3em] text-cyan-200">
            Relationship intelligence
          </p>

          <h2 className="mt-3 text-3xl font-semibold text-white">
            Governance context
          </h2>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <ContextCard
              title="Vendor criticality"
              value={vendor.tier || "Unassigned"}
            />

            <ContextCard
              title="Business dependency"
              value={vendor.criticality || "Unknown"}
            />

            <ContextCard
              title="Customer data exposure"
              value="Moderate"
            />

            <ContextCard
              title="Identity integration"
              value="SSO connected"
            />
          </div>

          <div className="mt-8 rounded-3xl border border-white/10 bg-slate-950/40 p-5">
            <p className="text-xs uppercase tracking-[0.25em] text-slate-500">
              Truvern insight
            </p>

            <p className="mt-4 leading-8 text-slate-300">
              This vendor appears to require recurring governance validation due
              to operational dependency, assessment frequency, and
              evidence-backed review expectations.
            </p>
          </div>
        </div>
      </section>


      {/* VENDOR_RELEASE_ARCHIVE */}
      <section id="release-archive" className="mt-8 rounded-3xl border border-emerald-400/20 bg-emerald-500/10 p-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-emerald-200">
              Release archive
            </p>

            <h2 className="mt-2 text-2xl font-semibold text-white">
              Immutable governance releases
            </h2>

            <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-300">
              Sealed release packets, PDFs, checksums, manifests, and signed attestations generated for this vendor.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-4">
          {assessmentRegistryRows.filter((row) => {
            const state = String(row.releaseState || row.status || "").toUpperCase();
            return state === "RELEASED" || state === "CONFIRMED" || row.checksum || row.manifestId;
          }).length > 0 ? (
            assessmentRegistryRows
              .filter((row) => {
                const state = String(row.releaseState || row.status || "").toUpperCase();
                return state === "RELEASED" || state === "CONFIRMED" || row.checksum || row.manifestId;
              })
              .map((row) => (
                <div
                  key={`release-${row.assignmentId}`}
                  className="rounded-3xl border border-white/10 bg-black/20 p-5"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-white">
                        Assignment #{row.assignmentId ?? "—"}
                      </p>

                      <p className="mt-1 text-xs text-slate-400">
                        {row.confirmedAt
                          ? `Confirmed ${new Date(row.confirmedAt).toLocaleDateString()}`
                          : row.releasedAt
                            ? `Released ${new Date(row.releasedAt).toLocaleDateString()}`
                            : "Release date unavailable"}
                      </p>

                      <div className="mt-3 flex flex-wrap gap-2 text-xs">
                        <span className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1 text-emerald-100">
                          {String(row.releaseState || "Archived").toUpperCase()}
                        </span>

                        {row.riskLevel ? (
                          <span className="rounded-full border border-amber-300/20 bg-amber-400/10 px-3 py-1 text-amber-100">
                            Risk {row.riskLevel}
                          </span>
                        ) : null}

                        {row.manifestId ? (
                          <span className="rounded-full border border-purple-300/20 bg-purple-400/10 px-3 py-1 text-purple-100">
                            Manifest #{row.manifestId}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {row.assignmentId ? (
                        <Link
                          href={`/review-desk/reviews/${row.assignmentId}/packet`}
                          className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-2 text-xs font-semibold text-emerald-100 hover:bg-emerald-400/15"
                        >
                          Packet
                        </Link>
                      ) : null}

                      {row.assignmentId ? (
                        <a
                          href={`/review-desk/reviews/${row.assignmentId}/packet/pdf?inline=1`}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-2 text-xs font-semibold text-cyan-100 hover:bg-cyan-400/15"
                        >
                          PDF
                        </a>
                      ) : null}

                      {row.assignmentId ? (
                        <a
                          href={`/api/review-desk/reviews/${row.assignmentId}/attestation`}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-full border border-teal-300/20 bg-teal-400/10 px-3 py-2 text-xs font-semibold text-teal-100 hover:bg-teal-400/15"
                        >
                          Attestation
                        </a>
                      ) : null}
                    </div>
                  </div>

                  {row.checksum ? (
                    <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                      <p className="text-xs uppercase tracking-[0.22em] text-slate-400">
                        Seal checksum
                      </p>
                      <p className="mt-2 break-all font-mono text-xs text-slate-200">
                        {row.checksum}
                      </p>
                    </div>
                  ) : null}
                </div>
              ))
          ) : (
            <div className="rounded-3xl border border-white/10 bg-black/20 p-6 text-sm text-slate-300">
              No immutable release archive exists for this vendor yet.
            </div>
          )}
        </div>
      </section>
      {/* VENDOR_ASSESSMENT_REGISTRY */}
      <section id="reviews" className="mt-8 rounded-3xl border border-cyan-400/20 bg-cyan-500/10 p-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-cyan-200">
              Assessment registry
            </p>

            <h2 className="mt-2 text-2xl font-semibold text-white">
              Governance review history
            </h2>

            <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-300">
              All managed reviews, release states, immutable packets, reviewer ownership,
              risk outcomes, and sealed governance artifacts for this vendor.
            </p>
          </div>

          <Link
            href={`/vendors/${vendor.id}/managed-review`}
            className="rounded-2xl bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-cyan-200"
          >
            Start managed review
          </Link>
        </div>

        {assessmentRegistryRows.length > 0 ? (
          <div className="mt-6 overflow-x-auto rounded-3xl border border-white/10">
            <table className="w-full min-w-[1100px] border-collapse text-left text-sm">
              <thead className="bg-slate-950/60 text-xs uppercase tracking-[0.22em] text-slate-400">
                <tr>
                  <th className="px-5 py-4">Assignment</th>
                  <th className="px-5 py-4">Type</th>
                  <th className="px-5 py-4">State</th>
                  <th className="px-5 py-4">Risk</th>
                  <th className="px-5 py-4">Decision</th>
                  <th className="px-5 py-4">Reviewer</th>
                  <th className="px-5 py-4">Updated</th>
                  <th className="px-5 py-4">Artifacts</th>
                </tr>
              </thead>

              <tbody>
                {assessmentRegistryRows
                  .filter((row) => {
                    const state = String(
                      row.releaseState || row.status || "PENDING"
                    ).toUpperCase();

                    const assignmentType = String(
                      row.assignmentType || ""
                    ).toUpperCase();

                    const hasReleaseArtifacts =
                      state === "RELEASED" ||
                      state === "CONFIRMED" ||
                      Boolean(row.manifestId) ||
                      Boolean(row.checksum);

                    const customerVisiblePending =
                      assignmentType === "TRUVERN" &&
                      state !== "DRAFT" &&
                      state !== "CANCELLED";

                    return hasReleaseArtifacts || customerVisiblePending;
                  })
                  .map((row) => {
                    const state = String(
                      row.releaseState || row.status || "PENDING"
                    ).toUpperCase();

                    const hasPacket =
                      state === "RELEASED" ||
                      state === "CONFIRMED";
                    
                    return (
                    <tr key={`${row.assignmentId}-${row.updatedAt}`} className="border-t border-white/10 text-slate-200">
                      <td className="px-5 py-4 font-semibold text-white">
                        #{row.assignmentId ?? "—"}
                      </td>

                      <td className="px-5 py-4">
                        {row.assignmentType || "Review"}
                      </td>

                      <td className="px-5 py-4">
                        <span className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-xs font-semibold text-cyan-100">
                          {state}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        {row.riskLevel || "—"}
                      </td>

                      <td className="px-5 py-4">
                        {row.decision || "—"}
                      </td>

                      <td className="px-5 py-4">
                        {row.reviewerName || row.reviewerUserId || "Unassigned"}
                      </td>

                      <td className="px-5 py-4 text-slate-400">
                        {row.updatedAt ? new Date(row.updatedAt).toLocaleDateString() : "—"}
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-2">
                          {row.assignmentId ? (
                            <Link
                              href={`/review-desk/${row.assignmentId}`}
                              className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs font-semibold text-white hover:bg-white/[0.08]"
                            >
                              Open
                            </Link>
                          ) : null}

                          {hasPacket && row.assignmentId ? (
                            <Link
                              href={`/review-desk/reviews/${row.assignmentId}/packet`}
                              className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-100 hover:bg-emerald-400/15"
                            >
                              Packet
                            </Link>
                          ) : null}

                          {hasPacket && row.assignmentId ? (
                            <a
                              href={`/review-desk/reviews/${row.assignmentId}/packet/pdf?inline=1`}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-xs font-semibold text-cyan-100 hover:bg-cyan-400/15"
                            >
                              PDF
                            </a>
                          ) : null}

                          {row.checksum ? (
                            <span className="rounded-full border border-purple-300/20 bg-purple-400/10 px-3 py-1 text-xs font-semibold text-purple-100">
                              Seal
                            </span>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="mt-6 rounded-3xl border border-white/10 bg-black/20 p-6 text-sm text-slate-300">
            No governance assessments have been created for this vendor yet.
          </div>
        )}
      </section>
      <div id="portal-access"><VendorPortalAccessPanel vendorId={vendor.id} /></div>
<section
        id="start-assessment"
        className="mt-8 rounded-3xl border border-cyan-300/20 bg-cyan-300/10 p-6"
      >
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-cyan-200">
              Assessment launch
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-white">
              Choose from Truvern catalog or your custom templates
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Preview ready-to-go assessment catalogs, create reusable templates, then launch the selected questionnaire to this vendor.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/assessments/catalog"
              className="rounded-full border border-white/15 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Assessment catalog
            </Link>

            <Link
              href="/assessments/templates/new"
              className="rounded-full bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
            >
              Create custom template
            </Link>
          </div>
        </div>

        <AssessmentStartChooser
          vendorId={vendor.id}
          vendorName={vendor.name}
          membershipTier={membershipTier}
          templates={templates.map((template) => ({
            id: template.id,
            name: template.name,
            description: template.description,
            standard: template.standard,
            category: template.category,
            version: template.version,
            status: template.isActive ? "Ready" : "Draft",
            sectionCount: template.sectionCount,
            questionCount: template.questionCount,
            sections: template.sections,
          }))}
        />
      </section>
<section
        id="request-evidence"
        className="mt-8 rounded-3xl border border-white/10 bg-white/[0.04] p-6"
      >
        <h2 className="text-2xl font-semibold text-white">
          Request evidence
        </h2>

        <p className="mt-2 text-slate-300">
          Initiate secure evidence collection workflows for governance review
          and operational verification.
        </p>

        <div className="mt-6">
          <NewEvidenceRequestForm
            vendors={[{ id: vendor.id, name: vendor.name }]}
            preselectVendorId={vendor.id}
          />
        </div>
      </section>
</main>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
      <p className="text-xs uppercase tracking-[0.25em] text-slate-500">
        {label}
      </p>

      <p className="mt-3 text-4xl font-semibold text-white">{value}</p>
    </div>
  );
}

function ContactCard({
  name,
  role,
  email,
  phone,
  isPrimary,
}: {
  name: string;
  role: string;
  email: string;
  phone: string;
  isPrimary: boolean;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-medium text-white">{name}</h3>

          <p className="mt-1 text-sm text-slate-400">{role}</p>
        </div>

        <div className="flex gap-2">
          {isPrimary ? (
            <div className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-xs text-emerald-100">
              Primary
            </div>
          ) : null}

          <div className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs text-cyan-100">
            Active
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-1 text-sm">
        <div className="text-cyan-100">{email}</div>

        {phone ? (
          <div className="text-slate-400">{phone}</div>
        ) : null}
      </div>
    </div>
  );
}

function ContextCard({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
        {title}
      </p>

      <div className="mt-3 text-xl font-semibold text-white">{value}</div>
    </div>
  );
}






























