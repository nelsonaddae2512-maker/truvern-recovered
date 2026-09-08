import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy | Truvern",
  description:
    "How Truvern handles account, vendor, assessment, evidence, communications, and governance workflow information.",
};

type Section = {
  title: string;
  paragraphs: string[];
  bullets?: string[];
};

const sections: Section[] = [
  {
    title: "1. Scope",
    paragraphs: [
      "This Privacy Policy describes how Truvern handles personal information in connection with its websites, customer accounts, vendor assessment workflows, evidence workflows, communications, governance operations, and related services.",
      "Where Truvern processes personal information on behalf of a customer, the customer may determine the purposes of that processing and additional terms may apply through the Data Processing Addendum or another written agreement.",
    ],
  },
  {
    title: "2. Information we collect",
    paragraphs: [
      "The information Truvern handles depends on how the service is used.",
    ],
    bullets: [
      "Account and profile information, such as names, business email addresses, roles, organization information, and authentication identifiers.",
      "Vendor information, including vendor names, contacts, ownership information, risk context, and relationship details supplied by customers or vendors.",
      "Assessment information, including questionnaire responses, scores, comments, review decisions, findings, remediation information, and attestations.",
      "Evidence and documents uploaded or submitted in support of assessments, remediation, or governance decisions.",
      "Communications data associated with vendor outreach, review operations, notifications, and support.",
      "Operational metadata, including timestamps, workflow states, audit records, security events, and technical information needed to operate and protect the service.",
      "Billing and transaction information associated with subscriptions, credits, and purchases. Payment card processing may be performed by a payment provider rather than stored directly by Truvern.",
    ],
  },
  {
    title: "3. How we use information",
    paragraphs: [
      "Truvern uses information to provide, secure, maintain, support, and improve the services requested by customers and vendors.",
    ],
    bullets: [
      "Operate vendor intake, assessment, evidence, review, remediation, attestation, and governance-release workflows.",
      "Authenticate users and enforce organization, role, and access controls.",
      "Send assessment requests, operational messages, notifications, and service communications.",
      "Generate and maintain governance records, reports, review history, audit trails, and verification artifacts.",
      "Process subscriptions, credits, billing, and related commercial transactions.",
      "Detect abuse, investigate incidents, troubleshoot failures, and protect platform integrity.",
      "Comply with legal obligations and enforce applicable agreements.",
    ],
  },
  {
    title: "4. Customer-controlled vendor and evidence data",
    paragraphs: [
      "Customers determine which vendors to assess and which information to submit through their governance workflows. Customers are responsible for ensuring that they have an appropriate basis to provide vendor contacts, documents, evidence, and other information to Truvern.",
      "Vendors may also provide assessment responses and evidence directly through secure vendor workflows. That information is used in connection with the applicable customer's review and governance process.",
    ],
  },
  {
    title: "5. How information is shared",
    paragraphs: [
      "Truvern does not disclose customer or vendor information except as needed to provide the service, follow customer instructions, protect the platform, complete a transaction, comply with law, or support a corporate transaction.",
      "Information may be shared with infrastructure and service providers that process information for Truvern under applicable contractual arrangements. Current provider categories are described on the Subprocessors page.",
    ],
  },
  {
    title: "6. Security",
    paragraphs: [
      "Truvern uses administrative, technical, and organizational measures designed to protect information against unauthorized access, alteration, loss, or disclosure.",
      "Security controls include access restrictions and technical safeguards appropriate to the service architecture. No system can guarantee absolute security, and customers should use appropriate controls when deciding what information to submit.",
    ],
  },
  {
    title: "7. Retention",
    paragraphs: [
      "Truvern retains information for as long as reasonably necessary to provide the service, maintain governance and audit records, satisfy contractual requirements, resolve disputes, protect the platform, and comply with applicable law.",
      "Retention may vary by data type, customer configuration, workflow state, contractual requirement, and legal obligation. Some information may remain in backups or immutable governance records for a limited period or as required by an applicable agreement.",
    ],
  },
  {
    title: "8. Cookies and similar technologies",
    paragraphs: [
      "Truvern may use cookies or similar technologies that are necessary for authentication, security, session management, preferences, and operation of the website and platform. Additional information may be provided through Truvern's cookie notice.",
    ],
  },
  {
    title: "9. Your choices and privacy rights",
    paragraphs: [
      "Depending on your location and applicable law, you may have rights to request access, correction, deletion, restriction, portability, or other action concerning personal information.",
      "Some information is controlled by a Truvern customer. In those circumstances, Truvern may direct a request to the relevant customer or assist the customer in responding as appropriate.",
      "Requests may be submitted through the Truvern contact page. Truvern may need to verify identity and authority before completing a request.",
    ],
  },
  {
    title: "10. International processing",
    paragraphs: [
      "Truvern and its service providers may process information in locations different from the location of the customer or individual. Where applicable law requires a transfer mechanism or additional safeguards, Truvern will use measures intended to support the required transfer.",
    ],
  },
  {
    title: "11. Children",
    paragraphs: [
      "Truvern is a business governance service and is not directed to children. Customers and vendors should not intentionally submit children's personal information unless it is necessary, lawful, and specifically appropriate for the relevant business process.",
    ],
  },
  {
    title: "12. Changes to this Policy",
    paragraphs: [
      "Truvern may update this Privacy Policy as the service, legal requirements, or privacy practices evolve. Material revisions will be reflected on this page with an updated effective date.",
    ],
  },
  {
    title: "13. Contact",
    paragraphs: [
      "Privacy questions and requests may be submitted through the Truvern contact page. Security-related reports may be directed to security@truvern.com.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-7xl px-6 py-16 text-white">
      <section className="grid gap-12 lg:grid-cols-[1fr_0.85fr] lg:items-start">
        <div>
          <div className="inline-flex rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm text-cyan-200">
            Privacy
          </div>

          <h1 className="mt-6 max-w-5xl text-5xl font-semibold tracking-tight md:text-7xl">
            Privacy for vendor governance workflows.
          </h1>

          <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-300">
            How Truvern handles account information, vendor data, assessments,
            evidence, communications, and governance workflow records.
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
              href="/dpa"
              className="rounded-full border border-white/15 px-7 py-4 font-semibold text-white transition hover:bg-white/10"
            >
              View DPA
            </Link>
          </div>
        </div>

        <div className="rounded-[2rem] border border-cyan-400/20 bg-white/[0.045] p-6 shadow-2xl shadow-cyan-950/20">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
            Privacy overview
          </p>

          <div className="mt-6 space-y-3">
            {[
              "Account and organization data",
              "Vendor, assessment, and evidence data",
              "Workflow and communications data",
              "Security and retention",
              "Service providers",
              "Privacy rights and requests",
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
          Additional processing terms are available in the{" "}
          <Link href="/dpa" className="font-semibold text-cyan-200 hover:text-cyan-100">
            Data Processing Addendum
          </Link>
          . Current infrastructure providers are listed on the{" "}
          <Link href="/subprocessors" className="font-semibold text-cyan-200 hover:text-cyan-100">
            Subprocessors
          </Link>{" "}
          page.
        </p>
      </section>
    </main>
  );
}