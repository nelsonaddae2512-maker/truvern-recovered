export type NistBaseline = "LOW" | "MODERATE" | "HIGH";

export type NistControlEnhancement = {
  enhancementId: string;
  title: string;
  description: string;

  implementationGuidance?: string;
  reviewerGuidance?: string;

  evidencePrompts?: string[];
  remediationGuidance?: string;

  attestationTriggers?: string[];

  weight?: number;
};

export type NistControlDefinition = {
  controlId: string;
  family: string;

  title: string;
  description: string;

  baseline: NistBaseline[];

  priority: number;
  weight?: number;

  implementationGuidance?: string;
  reviewerGuidance?: string;

  evidencePrompts: string[];

  remediationGuidance?: string;

  attestationTriggers?: string[];

  tags?: string[];

  enhancements?: NistControlEnhancement[];
};

export type NistFamilyDefinition = {
  family: string;
  title: string;
  description: string;

  controls: NistControlDefinition[];
};

export const NIST_800_53_REV5_LIBRARY: NistFamilyDefinition[] = [
  {
    family: "AC",
    title: "Access Control",
    description:
      "Controls governing logical and physical access to systems, applications, and information resources.",

    controls: [
      {
        controlId: "AC-1",
        family: "AC",

        title: "Policy and Procedures",

        description:
          "Develop, document, and disseminate access control policy and procedures.",

        baseline: ["LOW", "MODERATE", "HIGH"],

        priority: 1,
        weight: 10,

        implementationGuidance:
          "Organizations should maintain formally approved access control policies and operational procedures reviewed annually.",

        reviewerGuidance:
          "Verify policy approval, revision history, ownership, and evidence of operational enforcement.",

        evidencePrompts: [
          "Provide the current access control policy.",
          "Provide documented access management procedures.",
          "Provide evidence of annual review/approval.",
        ],

        remediationGuidance:
          "Create formal access control policy documentation with assigned ownership and periodic review cadence.",

        attestationTriggers: [
          "Policy approved by security leadership.",
          "Annual review completed.",
        ],

        tags: [
          "identity",
          "iam",
          "governance",
          "policy",
        ],
      },

      {
        controlId: "AC-2",
        family: "AC",

        title: "Account Management",

        description:
          "Manage information system accounts, including provisioning, monitoring, disabling, and removal.",

        baseline: ["LOW", "MODERATE", "HIGH"],

        priority: 1,
        weight: 20,

        implementationGuidance:
          "Implement centralized lifecycle management for workforce and privileged accounts.",

        reviewerGuidance:
          "Review onboarding/offboarding evidence, dormant account handling, and privileged access review cadence.",

        evidencePrompts: [
          "Provide user provisioning workflow evidence.",
          "Provide offboarding workflow evidence.",
          "Provide privileged access review records.",
          "Provide inactive account review evidence.",
        ],

        remediationGuidance:
          "Implement centralized IAM provisioning and periodic account review controls.",

        attestationTriggers: [
          "Privileged accounts reviewed quarterly.",
          "Dormant accounts disabled automatically.",
        ],

        tags: [
          "identity",
          "access",
          "privileged-access",
          "iam",
        ],

        enhancements: [
          {
            enhancementId: "AC-2(1)",

            title: "Automated System Account Management",

            description:
              "Automate support for account management processes.",

            implementationGuidance:
              "Use centralized IAM/SSO systems with automated provisioning/deprovisioning integrations.",

            reviewerGuidance:
              "Verify integrations with HRIS, directory services, or ticketing systems.",

            evidencePrompts: [
              "Provide IAM automation workflow screenshots.",
              "Provide HRIS integration evidence.",
            ],

            remediationGuidance:
              "Implement automated lifecycle integrations for workforce identity management.",

            weight: 5,
          },
        ],
      },

      {
        controlId: "AC-3",
        family: "AC",

        title: "Access Enforcement",

        description:
          "Enforce approved authorizations for logical access to information and system resources.",

        baseline: ["LOW", "MODERATE", "HIGH"],

        priority: 1,
        weight: 25,

        implementationGuidance:
          "Implement role-based access controls and authorization enforcement mechanisms.",

        reviewerGuidance:
          "Review RBAC mappings, authorization models, and enforcement evidence.",

        evidencePrompts: [
          "Provide RBAC documentation.",
          "Provide authorization matrix evidence.",
          "Provide enforcement screenshots or policy configuration exports.",
        ],

        remediationGuidance:
          "Implement centralized authorization enforcement using least privilege principles.",

        attestationTriggers: [
          "RBAC model reviewed annually.",
        ],

        tags: [
          "rbac",
          "authorization",
          "least-privilege",
        ],
      },
    ],
  },

  {
    family: "AU",
    title: "Audit and Accountability",
    description:
      "Controls governing logging, monitoring, retention, and accountability.",

    controls: [
      {
        controlId: "AU-1",
        family: "AU",

        title: "Policy and Procedures",

        description:
          "Develop and maintain audit and accountability policies and procedures.",

        baseline: ["LOW", "MODERATE", "HIGH"],

        priority: 1,
        weight: 10,

        implementationGuidance:
          "Organizations should establish centralized audit logging governance.",

        reviewerGuidance:
          "Verify ownership, retention requirements, and monitoring responsibilities.",

        evidencePrompts: [
          "Provide audit logging policy.",
          "Provide SIEM retention standards.",
        ],

        remediationGuidance:
          "Implement formal logging governance and centralized retention standards.",

        attestationTriggers: [
          "Audit logging policy approved.",
        ],

        tags: [
          "logging",
          "siem",
          "audit",
        ],
      },

      {
        controlId: "AU-2",
        family: "AU",

        title: "Event Logging",

        description:
          "Identify and log auditable events relevant to security and operations.",

        baseline: ["LOW", "MODERATE", "HIGH"],

        priority: 1,
        weight: 25,

        implementationGuidance:
          "Enable logging across infrastructure, identity systems, and applications.",

        reviewerGuidance:
          "Verify logging coverage, retention, integrity protections, and alerting.",

        evidencePrompts: [
          "Provide SIEM screenshots.",
          "Provide logging configuration exports.",
          "Provide alerting workflow evidence.",
        ],

        remediationGuidance:
          "Implement centralized SIEM logging and event correlation.",

        attestationTriggers: [
          "Critical systems send logs to centralized monitoring.",
        ],

        tags: [
          "siem",
          "logging",
          "monitoring",
        ],
      },
    ],
  },

  {
    family: "CM",
    title: "Configuration Management",
    description:
      "Controls governing secure configuration baselines and change management.",

    controls: [
      {
        controlId: "CM-2",
        family: "CM",

        title: "Baseline Configuration",

        description:
          "Establish and maintain baseline configurations for systems and components.",

        baseline: ["LOW", "MODERATE", "HIGH"],

        priority: 1,
        weight: 20,

        implementationGuidance:
          "Maintain documented hardened baseline configurations and secure images.",

        reviewerGuidance:
          "Verify baseline documentation and drift management controls.",

        evidencePrompts: [
          "Provide baseline configuration standards.",
          "Provide hardening benchmark evidence.",
          "Provide drift monitoring evidence.",
        ],

        remediationGuidance:
          "Implement standardized hardened baseline configurations.",

        attestationTriggers: [
          "Production systems use approved hardened baselines.",
        ],

        tags: [
          "hardening",
          "baseline",
          "configuration-management",
        ],
      },
    ],
  },
];

