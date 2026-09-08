import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Data Processing Addendum | Truvern",
  description:
    "Data processing terms for personal data Truvern processes on behalf of customers using vendor governance services.",
};

type Section = {
  title: string;
  paragraphs: string[];
  bullets?: string[];
};

const sections: Section[] = [
  {
    title: "1. Scope and relationship to the Terms",
    paragraphs: [
      "This Data Processing Addendum applies when Truvern processes personal data on behalf of a customer in connection with the services and applicable data protection law requires processor terms.",
      "This DPA supplements the Terms of Service and any applicable order form or written agreement. If the parties have executed a separate data processing agreement, the signed agreement controls to the extent of any conflict.",
    ],
  },
  {
    title: "2. Roles of the parties",
    paragraphs: [
      "For personal data that a customer submits to Truvern for vendor governance workflows, the customer generally determines the purposes and means of the processing and Truvern processes that information on the customer's documented instructions.",
      "Truvern may separately act as an independent controller for limited business information it processes for its own legitimate operational purposes, such as account administration, security, billing, legal compliance, and business communications.",
    ],
  },
  {
    title: "3. Processing instructions",
    paragraphs: [
      "Customer instructs Truvern to process covered personal data as necessary to provide, secure, support, and maintain the services; perform requested Truvern Reviews; operate assessment and evidence workflows; generate governance outputs; and comply with the applicable agreement.",
      "Truvern will not materially process covered personal data for unrelated purposes except where required by applicable law.",
    ],
  },
  {
    title: "4. Processing details",
    paragraphs: [
      "Processing may include collection, storage, organization, retrieval, transmission, review, analysis, communication, restriction, deletion, and other operations necessary to provide the services.",
    ],
    bullets: [
      "Data subjects may include customer users, vendor contacts, vendor personnel, reviewers, approvers, and other individuals whose information is included in customer-directed governance workflows.",
      "Data may include identity and contact information, professional information, assessment responses, evidence, communications, workflow metadata, remediation information, attestations, and audit records.",
      "The duration of processing generally follows the customer's use of the service plus retention reasonably required for contractual, security, backup, audit, and legal purposes.",
    ],
  },
  {
    title: "5. Confidentiality",
    paragraphs: [
      "Truvern will ensure that personnel authorized to process covered personal data are subject to appropriate confidentiality obligations and receive access only as necessary for their responsibilities.",
    ],
  },
  {
    title: "6. Security measures",
    paragraphs: [
      "Truvern maintains technical and organizational measures designed to protect covered personal data against unauthorized or unlawful processing and against accidental loss, destruction, alteration, or disclosure.",
    ],
    bullets: [
      "Identity, authentication, and access controls.",
      "Organization and role-based access restrictions.",
      "Protected evidence storage and controlled retrieval workflows.",
      "Operational logging and governance audit records.",
      "Security-oriented deployment and infrastructure controls.",
      "Procedures intended to identify, investigate, and respond to security events.",
    ],
  },
  {
    title: "7. Subprocessors",
    paragraphs: [
      "Customer authorizes Truvern to use subprocessors reasonably necessary to provide the services. Truvern will impose data protection obligations appropriate to the services performed by those subprocessors.",
      "Truvern maintains a current list of material infrastructure and service providers on the Subprocessors page. Truvern may update that list as its service architecture changes.",
    ],
  },
  {
    title: "8. Personal data breach",
    paragraphs: [
      "If Truvern becomes aware of a confirmed personal data breach affecting covered personal data processed on behalf of a customer, Truvern will notify the affected customer without undue delay as required by applicable law and the applicable agreement.",
      "Truvern will provide information reasonably available to support the customer's assessment and response and may provide information in phases as an investigation develops.",
    ],
  },
  {
    title: "9. Data subject requests",
    paragraphs: [
      "Taking into account the nature of the processing, Truvern will provide reasonable assistance to customers responding to verified requests from individuals exercising applicable data protection rights where the relevant information is processed by Truvern on the customer's behalf.",
      "If Truvern receives a request relating primarily to customer-controlled data, Truvern may direct the requester to the applicable customer unless prohibited by law.",
    ],
  },
  {
    title: "10. Regulatory and impact-assessment assistance",
    paragraphs: [
      "Taking into account the nature of the processing and information available to Truvern, Truvern will provide reasonable assistance with legally required data protection impact assessments, consultations, or regulator inquiries relating to Truvern's processing of covered personal data.",
    ],
  },
  {
    title: "11. Return and deletion",
    paragraphs: [
      "Following termination of the applicable services, Truvern will delete or return covered personal data as required by the applicable agreement and law, subject to technically necessary backup cycles, immutable governance records, security records, legal holds, or other lawful retention requirements.",
    ],
  },
  {
    title: "12. Audit and compliance information",
    paragraphs: [
      "Truvern will make available information reasonably necessary to demonstrate compliance with applicable processor obligations, subject to appropriate confidentiality, security, and proportionality protections.",
      "Any on-site or additional audit rights are subject to the applicable written agreement and reasonable measures designed to avoid unnecessary disruption or exposure of information belonging to other customers.",
    ],
  },
  {
    title: "13. International transfers",
    paragraphs: [
      "Where processing involves an international transfer subject to transfer restrictions, the parties will use an applicable lawful transfer mechanism and any supplementary safeguards required by applicable law.",
    ],
  },
  {
    title: "14. Customer responsibilities",
    paragraphs: [
      "Customer is responsible for the lawfulness of its instructions, the information it submits, required notices or consents, and its independent obligations as controller or business under applicable data protection law.",
    ],
  },
  {
    title: "15. Contact",
    paragraphs: [
      "Questions about this DPA or Truvern's data processing practices may be submitted through the Truvern contact page.",
    ],
  },
];

export default function DpaPage() {
  return (
    <main className="mx-auto max-w-7xl px-6 py-16 text-white">
      <section className="grid gap-12 lg:grid-cols-[1fr_0.85fr] lg:items-start">
        <div>
          <div className="inline-flex rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm text-cyan-200">
            Data Processing
          </div>

          <h1 className="mt-6 max-w-5xl text-5xl font-semibold tracking-tight md:text-7xl">
            Data Processing Addendum.
          </h1>

          <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-300">
            Processing terms for personal data Truvern handles on behalf of
            customers operating vendor governance workflows.
          </p>

          <p className="mt-5 text-sm text-slate-500">
            Effective September 8, 2026
          </p>

          <div className="mt-10 flex flex-wrap gap-4">
            <Link
              href="/contact"
              className="rounded-full bg-cyan-300 px-7 py-4 font-semibold text-slate-950 transition hover:bg-cyan-200"
            >
              Contact Truvern
            </Link>

            <Link
              href="/subprocessors"
              className="rounded-full border border-white/15 px-7 py-4 font-semibold text-white transition hover:bg-white/10"
            >
              View Subprocessors
            </Link>
          </div>
        </div>

        <div className="rounded-[2rem] border border-cyan-400/20 bg-white/[0.045] p-6 shadow-2xl shadow-cyan-950/20">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
            Processing framework
          </p>

          <div className="mt-6 space-y-3">
            {[
              "Customer instructions",
              "Processor responsibilities",
              "Security and confidentiality",
              "Subprocessor controls",
              "Rights and incident assistance",
              "Deletion, audit, and transfers",
            ].map((item, index) => (
              <div
                key={item}
                className="flex items-center gap-4 rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full border border-cyan-300/30 bg-cyan-300/10 text-sm font-semibold text-cyan-100">
                  {index + 1}
                </div>
                <p className="text-sm text-slate-200">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-16 grid gap-5">
        {sections.map((section) => (
          <article
            key={section.title}
            className="rounded-3xl border border-white/10 bg-white/[0.035] p-6 md:p-8"
          >
            <h2 className="text-xl font-semibold">{section.title}</h2>

            <div className="mt-4 space-y-4 text-sm leading-7 text-slate-300 md:text-base">
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}

              {section.bullets ? (
                <ul className="list-disc space-y-2 pl-6">
                  {section.bullets.map((bullet) => (
                    <li key={bullet}>{bullet}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          </article>
        ))}
      </section>

      <section className="mt-10 rounded-3xl border border-cyan-400/20 bg-cyan-400/[0.06] p-6 text-sm leading-7 text-slate-300">
        <p>
          See the{" "}
          <Link href="/privacy" className="font-semibold text-cyan-200 hover:text-cyan-100">
            Privacy Policy
          </Link>{" "}
          and current{" "}
          <Link href="/subprocessors" className="font-semibold text-cyan-200 hover:text-cyan-100">
            Subprocessors
          </Link>{" "}
          for additional information.
        </p>
      </section>
    </main>
  );
}