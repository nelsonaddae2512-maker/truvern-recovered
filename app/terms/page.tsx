import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service | Truvern",
  description:
    "Terms governing access to Truvern vendor governance operations, Self-Managed Reviews, Truvern Reviews, evidence workflows, and related services.",
};

type Section = {
  title: string;
  paragraphs: string[];
  bullets?: string[];
};

const sections: Section[] = [
  {
    title: "1. Agreement and scope",
    paragraphs: [
      "These Terms of Service govern access to and use of Truvern's vendor governance platform, websites, assessment workflows, review services, evidence workflows, reports, and related services.",
      "By creating an account, accessing the platform, or requesting a service, you agree to these Terms on behalf of yourself and, when applicable, the organization you represent. If a written order form, enterprise agreement, or other signed agreement applies, that agreement controls to the extent of any conflict.",
    ],
  },
  {
    title: "2. Accounts and authorized users",
    paragraphs: [
      "Customers are responsible for maintaining accurate account information, limiting access to authorized users, protecting credentials, and promptly removing access that is no longer required.",
      "You are responsible for activity performed through your organization's authorized accounts except to the extent caused by Truvern's breach of its obligations.",
    ],
  },
  {
    title: "3. Platform services",
    paragraphs: [
      "Truvern provides workflows for vendor intake, assessments, evidence collection, review, findings, remediation, attestations, governance decisions, reporting, and related operational records.",
      "Features and availability may vary by plan, service selection, organization configuration, and product updates.",
    ],
  },
  {
    title: "4. Self-Managed Review",
    paragraphs: [
      "A Self-Managed Review allows the customer's own team to operate the review workflow using Truvern. The customer remains responsible for reviewer assignments, conclusions, approvals, remediation decisions, and release decisions made through that review path.",
      "Truvern provides the workflow and supporting platform capabilities but does not become the customer's internal decision maker merely because the platform is used.",
    ],
  },
  {
    title: "5. Truvern Review",
    paragraphs: [
      "A Truvern Review is a separate review service in which Truvern personnel may coordinate vendor outreach, questionnaires, evidence review, findings, remediation follow-up, attestations, and preparation of governance outputs.",
      "When requesting a Truvern Review, the customer authorizes Truvern to contact the applicable vendor and process information reasonably necessary to perform the requested review.",
      "A Truvern Review supports the customer's governance process. It does not guarantee that a vendor is secure, compliant, free from vulnerabilities, or suitable for every customer use case.",
    ],
  },
  {
    title: "6. Credits, charges, and payment",
    paragraphs: [
      "Certain Truvern Review services are purchased or consumed through Truvern credits or other commercial arrangements shown in the platform, pricing materials, or an applicable order form.",
      "The platform may require an acknowledgement before a Truvern Review is requested. A pending Truvern Review may be eligible for cancellation before Truvern work starts. Once Truvern work has started, the review may no longer be cancellable through the normal workflow and the applicable credit or charge may remain consumed.",
      "Self-Managed Review access, subscription fees, credits, and other paid services are governed by the applicable plan, checkout terms, order form, or written commercial agreement.",
    ],
  },
  {
    title: "7. Customer and vendor information",
    paragraphs: [
      "Customers may provide vendor contacts, assessment responses, documents, evidence, remediation information, attestations, and other governance data. Customers represent that they have the authority to provide that information to Truvern and to instruct Truvern to process it for the requested services.",
      "Customers should not upload information that they are prohibited from disclosing or that is unnecessary for the relevant governance purpose.",
    ],
  },
  {
    title: "8. Acceptable use",
    paragraphs: [
      "You may not misuse Truvern, interfere with the service, attempt unauthorized access, circumvent access controls, introduce malicious code, use the service to violate law or third-party rights, or use Truvern data to facilitate unlawful discrimination, fraud, abuse, or security attacks.",
      "Automated access, scraping, reverse engineering, or attempts to defeat technical restrictions are prohibited except where expressly permitted by law or by Truvern in writing.",
    ],
  },
  {
    title: "9. Governance outputs and professional judgment",
    paragraphs: [
      "Scores, findings, recommendations, reports, attestations, release packages, and other outputs are based on the information available to the applicable workflow at the time they are produced.",
      "Governance outputs are intended to support informed decision making and do not replace legal, regulatory, financial, insurance, penetration-testing, audit, or other professional advice where those services are required.",
      "Customers remain responsible for their ultimate vendor approval, risk acceptance, contracting, procurement, and business decisions.",
    ],
  },
  {
    title: "10. Intellectual property",
    paragraphs: [
      "Truvern and its licensors retain ownership of the platform, software, designs, workflow logic, documentation, trademarks, and other proprietary materials. Customers retain their rights in data and materials they submit to Truvern.",
      "Subject to these Terms and any applicable commercial agreement, Truvern grants authorized users a limited right to use the service for their organization's internal business and governance purposes.",
    ],
  },
  {
    title: "11. Confidentiality",
    paragraphs: [
      "Each party should protect non-public information received from the other party using reasonable safeguards and use that information only for the purposes for which it was disclosed, except where disclosure is required by law or authorized by the disclosing party.",
      "Additional confidentiality obligations in an order form, nondisclosure agreement, or other signed agreement continue to apply.",
    ],
  },
  {
    title: "12. Third-party services and subprocessors",
    paragraphs: [
      "Truvern uses third-party infrastructure and service providers to operate the platform. Current provider information is available on the Subprocessors page.",
      "Third-party services may be governed by their own terms and technical limitations. Truvern remains responsible for its own contractual obligations concerning the services it provides.",
    ],
  },
  {
    title: "13. Security and availability",
    paragraphs: [
      "Truvern maintains administrative, technical, and organizational measures designed to protect information handled through the platform. No internet service or security control can eliminate all risk.",
      "Truvern may perform maintenance, deploy updates, restrict unsafe activity, or temporarily suspend access when reasonably necessary to protect the service, customers, vendors, or platform integrity.",
      "Any service-level commitment specifically stated in an applicable written agreement controls over this section.",
    ],
  },
  {
    title: "14. Suspension and termination",
    paragraphs: [
      "Truvern may restrict or suspend access where reasonably necessary to address security risk, unlawful use, material breach, nonpayment, or threats to the platform or other users.",
      "Upon termination, access to some platform features may end. Data handling after termination is subject to the applicable agreement, Truvern's Privacy Policy, legal obligations, and technically necessary backup or archival processes.",
    ],
  },
  {
    title: "15. Disclaimers and limitation of liability",
    paragraphs: [
      "Except for obligations expressly stated in an applicable written agreement, the service is provided to the extent permitted by law without warranties that every assessment, finding, vendor response, third-party statement, or governance decision will be complete or error-free.",
      "To the fullest extent permitted by applicable law, neither party will be liable for indirect, incidental, special, exemplary, punitive, or consequential damages arising from use of the service. Any additional liability limitation or negotiated remedy in an applicable order form or signed agreement controls.",
    ],
  },
  {
    title: "16. Changes to these Terms",
    paragraphs: [
      "Truvern may update these Terms as the service, legal requirements, or commercial practices evolve. The current version will be posted on this page with an updated effective date when material revisions are made.",
    ],
  },
  {
    title: "17. Contact",
    paragraphs: [
      "Questions about these Terms or Truvern services may be submitted through the Truvern contact page.",
    ],
  },
];

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-7xl px-6 py-16 text-white">
      <section className="grid gap-12 lg:grid-cols-[1fr_0.85fr] lg:items-start">
        <div>
          <div className="inline-flex rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm text-cyan-200">
            Terms
          </div>

          <h1 className="mt-6 max-w-5xl text-5xl font-semibold tracking-tight md:text-7xl">
            Terms of Service.
          </h1>

          <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-300">
            Terms governing Truvern platform access, Self-Managed Reviews,
            Truvern Reviews, vendor evidence workflows, governance outputs, and
            related services.
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
              href="/privacy"
              className="rounded-full border border-white/15 px-7 py-4 font-semibold text-white transition hover:bg-white/10"
            >
              Privacy Policy
            </Link>
          </div>
        </div>

        <div className="rounded-[2rem] border border-cyan-400/20 bg-white/[0.045] p-6 shadow-2xl shadow-cyan-950/20">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
            Key topics
          </p>

          <div className="mt-6 space-y-3">
            {[
              "Platform and account access",
              "Self-Managed Review",
              "Truvern Review and credits",
              "Evidence and governance outputs",
              "Acceptable use and security",
              "Commercial and legal terms",
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
            <h2 className="text-xl font-semibold text-white">
              {section.title}
            </h2>

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
          See also{" "}
          <Link href="/privacy" className="font-semibold text-cyan-200 hover:text-cyan-100">
            Privacy
          </Link>
          ,{" "}
          <Link href="/dpa" className="font-semibold text-cyan-200 hover:text-cyan-100">
            Data Processing Addendum
          </Link>
          , and{" "}
          <Link href="/subprocessors" className="font-semibold text-cyan-200 hover:text-cyan-100">
            Subprocessors
          </Link>
          .
        </p>
      </section>
    </main>
  );
}