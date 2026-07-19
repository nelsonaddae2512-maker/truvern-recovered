-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "OrgRole" AS ENUM ('OWNER', 'ADMIN', 'ANALYST', 'VIEWER', 'VENDOR');

-- CreateEnum
CREATE TYPE "PlanTier" AS ENUM ('FREE', 'PRO', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('INACTIVE', 'TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED');

-- CreateEnum
CREATE TYPE "VendorTier" AS ENUM ('CRITICAL', 'IMPORTANT', 'STANDARD');

-- CreateEnum
CREATE TYPE "VendorCriticality" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "AssessmentStatus" AS ENUM ('DRAFT', 'LAUNCHED', 'IN_PROGRESS', 'SUBMITTED', 'REVIEW_READY', 'UNDER_REVIEW', 'RELEASED', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "IssueSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "IssueStatus" AS ENUM ('OPEN', 'IN_REVIEW', 'RESOLVED', 'ACCEPTED_RISK');

-- CreateEnum
CREATE TYPE "EvidenceKind" AS ENUM ('POLICY', 'REPORT', 'SCREENSHOT', 'CERTIFICATE', 'OTHER');

-- CreateEnum
CREATE TYPE "EvidenceRequestStatus" AS ENUM ('OPEN', 'SUBMITTED', 'APPROVED', 'REJECTED', 'CANCELLED', 'REQUESTED');

-- CreateEnum
CREATE TYPE "EvidenceRequestKind" AS ENUM ('SOC2', 'ISO27001', 'POLICY', 'PEN_TEST', 'BCP_DRP', 'DPIA', 'OTHER');

-- CreateEnum
CREATE TYPE "AssessmentQuestionType" AS ENUM ('TEXT', 'YES_NO', 'SELECT', 'MULTI_SELECT', 'NUMBER');

-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('BOOLEAN', 'TEXT', 'MULTI_CHOICE', 'YES_NO', 'NUMBER', 'MULTIPLE_CHOICE', 'FILE_UPLOAD');

-- CreateEnum
CREATE TYPE "VendorContactRole" AS ENUM ('PRIMARY', 'SECURITY', 'COMPLIANCE', 'LEGAL', 'OTHER');

-- CreateEnum
CREATE TYPE "TemplateAccessTier" AS ENUM ('FREE', 'PRO', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "TemplateSource" AS ENUM ('SYSTEM', 'CUSTOM');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('ASSESSMENT_ASSIGNED_INTERNAL', 'ASSESSMENT_ASSIGNED_TRUVERN', 'REVIEW_COMPLETED', 'ISSUE_ASSIGNED', 'ISSUE_ESCALATED', 'EVIDENCE_REQUEST_OVERDUE', 'PROGRAM_STATE_SEALED', 'REVIEW_STARTED', 'REVIEW_RELEASED', 'ASSESSMENT_SUBMITTED', 'EVIDENCE_REQUEST_ASSIGNED', 'VENDOR_ASSESSMENT_RECEIVED', 'BOARD_PACKET_SEALED', 'TRUST_NETWORK_PUBLISHED', 'REVIEW_RELEASE_REQUESTED', 'REVIEW_RELEASE_APPROVED', 'REVIEW_RELEASE_DENIED', 'VENDOR_SUBMITTED', 'REVIEW_ASSIGNED', 'TRUVERN_RELEASE_READY', 'TRUVERN_RELEASED', 'RELEASE_CONFIRMATION_REQUIRED', 'REASSESSMENT_DUE', 'REASSESSMENT_OVERDUE', 'LOW_CREDITS', 'CREDITS_GRANTED', 'PLAN_OVERRIDE_APPLIED', 'PLAN_OVERRIDE_EXPIRING', 'GOVERNANCE_SEAL_VERIFIED');

-- CreateEnum
CREATE TYPE "NotificationSeverity" AS ENUM ('INFO', 'SUCCESS', 'WARNING', 'CRITICAL');

-- CreateEnum
CREATE TYPE "TruvernFrameworkStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "TruvernControlRequirementLevel" AS ENUM ('LOW', 'MODERATE', 'HIGH', 'BASELINE', 'CUSTOM');

-- CreateEnum
CREATE TYPE "TruvernAssessmentLifecycleStatus" AS ENUM ('DRAFT', 'SENT_TO_VENDOR', 'VENDOR_IN_PROGRESS', 'SUBMITTED', 'IN_REVIEW', 'REMEDIATION_REQUESTED', 'ATTESTATION_REQUESTED', 'READY_FOR_RELEASE', 'RELEASED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TruvernFindingSeverity" AS ENUM ('INFO', 'LOW', 'MODERATE', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "TruvernFindingStatus" AS ENUM ('OPEN', 'REMEDIATION_REQUESTED', 'REMEDIATED', 'ACCEPTED_RISK', 'FALSE_POSITIVE', 'CLOSED');

-- CreateEnum
CREATE TYPE "TruvernRemediationStatus" AS ENUM ('REQUESTED', 'IN_PROGRESS', 'SUBMITTED', 'ACCEPTED', 'REJECTED', 'WAIVED');

-- CreateEnum
CREATE TYPE "TruvernAttestationStatus" AS ENUM ('REQUESTED', 'SUBMITTED', 'ACCEPTED', 'REJECTED', 'EXPIRED');

-- CreateTable
CREATE TABLE "Organization" (
    "clerkOrgId" TEXT,
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "planTier" TEXT DEFAULT 'FREE',

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewAssignment" (
    "id" SERIAL NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "vendorId" INTEGER NOT NULL,
    "reviewRequestId" INTEGER,
    "assignmentType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "reviewerUserId" TEXT,
    "assignedReviewerName" TEXT,
    "reviewerName" TEXT,
    "assignedTo" TEXT,
    "note" TEXT,
    "createdBy" TEXT,
    "startedAt" TIMESTAMP(3),
    "claimedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReviewAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "clerkId" TEXT,
    "organizationId" INTEGER,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrgMembership" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "role" "OrgRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrgMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityEvent" (
    "id" SERIAL NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "actorUserId" TEXT,
    "actorName" TEXT,
    "actorEmail" TEXT,
    "vendorId" INTEGER,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vendor" (
    "lastAssessmentCompletedAt" TIMESTAMP(3),
    "nextReviewDueAt" TIMESTAMP(3),
    "reviewCadenceDays" INTEGER,
    "id" SERIAL NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "category" TEXT,
    "tier" "VendorTier",
    "criticality" "VendorCriticality",
    "riskScore" INTEGER,
    "status" TEXT,
    "summary" TEXT,
    "contactName" TEXT,
    "contactEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "riskTrend30d" TEXT,
    "riskTrend90d" TEXT,

    CONSTRAINT "Vendor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorContact" (
    "id" SERIAL NOT NULL,
    "vendorId" INTEGER NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "role" "VendorContactRole" NOT NULL DEFAULT 'OTHER',
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VendorContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorRiskAlert" (
    "id" SERIAL NOT NULL,
    "vendorId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "VendorRiskAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GovernanceTransparencyLog" (
    "id" SERIAL NOT NULL,
    "entryId" TEXT NOT NULL,
    "assignmentId" INTEGER NOT NULL,
    "responseId" INTEGER NOT NULL,
    "checksum" TEXT NOT NULL,
    "ledgerHash" TEXT NOT NULL,
    "receiptId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "previousEntryHash" TEXT,
    "entryHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "eventKey" TEXT,
    "eventType" TEXT,
    "eventHash" TEXT,
    "payloadHash" TEXT,
    "actorUserId" TEXT,
    "organizationId" INTEGER,
    "reviewAssignmentId" INTEGER,
    "reviewRequestId" INTEGER,
    "vendorId" INTEGER,
    "metadataJson" JSONB NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GovernanceTransparencyLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrustProfile" (
    "id" SERIAL NOT NULL,
    "vendorId" INTEGER NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "publicSlug" TEXT,
    "headline" TEXT,
    "summary" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrustProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorShareToken" (
    "id" SERIAL NOT NULL,
    "vendorId" INTEGER NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VendorShareToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrustLink" (
    "id" SERIAL NOT NULL,
    "trustProfileId" INTEGER NOT NULL,
    "token" TEXT NOT NULL,
    "label" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrustLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvidenceRequest" (
    "id" SERIAL NOT NULL,
    "vendorId" INTEGER NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "kind" "EvidenceRequestKind" NOT NULL DEFAULT 'OTHER',
    "label" TEXT NOT NULL,
    "description" TEXT,
    "dueAt" TIMESTAMP(3),
    "status" "EvidenceRequestStatus" NOT NULL DEFAULT 'OPEN',
    "evidenceId" INTEGER,
    "submittedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "assessmentRunId" INTEGER,
    "title" TEXT,
    "category" TEXT,
    "requestedAt" TIMESTAMP(6),
    "completedAt" TIMESTAMP(6),
    "notes" TEXT,
    "reviewerNotes" TEXT,
    "vendorResponse" TEXT,
    "resolutionNotes" TEXT,
    "completedBy" TEXT,
    "assignedTo" TEXT,
    "attachmentCount" INTEGER DEFAULT 0,
    "evidenceCount" INTEGER DEFAULT 0,
    "fulfilledEvidenceId" INTEGER,
    "fulfilledAt" TIMESTAMP(6),

    CONSTRAINT "EvidenceRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvidenceRequestIteration" (
    "id" SERIAL NOT NULL,
    "evidenceRequestId" INTEGER NOT NULL,
    "status" "EvidenceRequestStatus" NOT NULL DEFAULT 'SUBMITTED',
    "submittedBy" TEXT,
    "submittedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewerNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvidenceRequestIteration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentTemplate" (
    "id" SERIAL NOT NULL,
    "organizationId" INTEGER,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "standard" TEXT,
    "code" TEXT,
    "category" TEXT,
    "version" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "source" "TemplateSource" NOT NULL DEFAULT 'CUSTOM',
    "accessTier" "TemplateAccessTier",
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "catalogKey" TEXT,
    "origin" TEXT DEFAULT 'CUSTOM',

    CONSTRAINT "AssessmentTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentSection" (
    "id" SERIAL NOT NULL,
    "templateId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "weight" DOUBLE PRECISION,

    CONSTRAINT "AssessmentSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentQuestion" (
    "id" SERIAL NOT NULL,
    "templateId" INTEGER,
    "sectionId" INTEGER,
    "orderIndex" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "helpText" TEXT,
    "description" TEXT,
    "category" TEXT,
    "type" "QuestionType" NOT NULL,
    "richType" "AssessmentQuestionType",
    "required" BOOLEAN NOT NULL DEFAULT false,
    "weight" INTEGER,
    "key" TEXT,
    "options" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssessmentQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Assessment" (
    "id" SERIAL NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "vendorId" INTEGER NOT NULL,
    "templateId" INTEGER,
    "status" "AssessmentStatus" NOT NULL DEFAULT 'DRAFT',
    "token" TEXT,
    "vendorEmail" TEXT,
    "vendorContactName" TEXT,
    "launchedAt" TIMESTAMP(3),
    "openedAt" TIMESTAMP(3),
    "reviewReadyAt" TIMESTAMP(3),
    "submissionVersion" INTEGER NOT NULL DEFAULT 1,
    "internalReviewerId" TEXT,
    "truvernReviewerId" TEXT,
    "reviewAssignmentId" INTEGER,
    "completionPercent" INTEGER NOT NULL DEFAULT 0,
    "isVendorSubmitted" BOOLEAN NOT NULL DEFAULT false,
    "title" TEXT,
    "dueAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "reopenedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "score" INTEGER,
    "confidentialityScore" INTEGER,
    "integrityScore" INTEGER,
    "availabilityScore" INTEGER,

    CONSTRAINT "Assessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IssueEvent" (
    "id" SERIAL NOT NULL,
    "issueId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IssueEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentAnswer" (
    "id" SERIAL NOT NULL,
    "assessmentId" INTEGER NOT NULL,
    "questionId" INTEGER NOT NULL,
    "value" TEXT,
    "valueJson" JSONB,
    "riskImpact" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssessmentAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evidence" (
    "id" SERIAL NOT NULL,
    "vendorId" INTEGER NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "assessmentId" INTEGER,
    "uploadedById" INTEGER,
    "evidenceRequestId" INTEGER,
    "iterationId" INTEGER,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "fileUrl" TEXT,
    "kind" "EvidenceKind" NOT NULL DEFAULT 'OTHER',
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    "notes" TEXT,
    "url" TEXT,
    "createdAt" TIMESTAMP(6),
    "updatedAt" TIMESTAMP(6),
    "documentDate" TIMESTAMP(6),
    "validUntil" TIMESTAMP(6),

    CONSTRAINT "Evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Issue" (
    "id" SERIAL NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "vendorId" INTEGER NOT NULL,
    "assessmentId" INTEGER,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "severity" "IssueSeverity" NOT NULL DEFAULT 'MEDIUM',
    "status" "IssueStatus" NOT NULL DEFAULT 'OPEN',
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "createdById" INTEGER,
    "assignedToId" INTEGER,

    CONSTRAINT "Issue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingPlan" (
    "id" SERIAL NOT NULL,
    "tier" "PlanTier" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "stripePriceId" TEXT,
    "maxVendors" INTEGER,
    "maxMembers" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorRiskSnapshot" (
    "id" SERIAL NOT NULL,
    "vendorId" INTEGER NOT NULL,
    "score" INTEGER,
    "takenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VendorRiskSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorPortalUser" (
    "id" SERIAL NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "vendorId" INTEGER NOT NULL,
    "clerkUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VendorPortalUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" SERIAL NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "planId" INTEGER NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'INACTIVE',
    "stripeCustomerId" TEXT,
    "stripeSubId" TEXT,
    "currentPeriodEnd" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsageEvent" (
    "id" SERIAL NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "vendorId" INTEGER,
    "kind" TEXT NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsageEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InviteToken" (
    "id" SERIAL NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "email" TEXT NOT NULL,
    "role" "OrgRole" NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InviteToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentRun" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "vendorId" INTEGER,
    "assessmentId" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "templateId" INTEGER,

    CONSTRAINT "AssessmentRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GovernanceReleaseManifest" (
    "id" SERIAL NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "vendorId" INTEGER,
    "assessmentRunId" INTEGER,
    "reviewAssignmentId" INTEGER,
    "reviewResponseId" INTEGER,
    "manifestVersion" TEXT NOT NULL DEFAULT 'GRM-1.0',
    "governanceVersion" TEXT,
    "releaseState" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "packetChecksum" TEXT,
    "fundingChecksum" TEXT,
    "reviewerName" TEXT,
    "releasedAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "finalizedAt" TIMESTAMP(3),
    "immutableSnapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GovernanceReleaseManifest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationPlanOverride" (
    "id" SERIAL NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "planTier" TEXT NOT NULL,
    "reason" TEXT,
    "createdByUserId" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationPlanOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" SERIAL NOT NULL,
    "userId" TEXT,
    "organizationId" INTEGER,
    "type" "NotificationType" NOT NULL,
    "severity" "NotificationSeverity" NOT NULL DEFAULT 'INFO',
    "title" TEXT NOT NULL,
    "message" TEXT,
    "href" TEXT,
    "metadataJson" JSONB,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TruvernFramework" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "version" TEXT,
    "status" "TruvernFrameworkStatus" NOT NULL DEFAULT 'DRAFT',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TruvernFramework_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TruvernControl" (
    "id" SERIAL NOT NULL,
    "frameworkId" INTEGER NOT NULL,
    "controlId" TEXT NOT NULL,
    "family" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "discussion" TEXT,
    "guidance" TEXT,
    "requirementLevel" "TruvernControlRequirementLevel",
    "baselineLow" BOOLEAN NOT NULL DEFAULT false,
    "baselineModerate" BOOLEAN NOT NULL DEFAULT false,
    "baselineHigh" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TruvernControl_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TruvernControlQuestion" (
    "id" SERIAL NOT NULL,
    "controlId" INTEGER NOT NULL,
    "prompt" TEXT NOT NULL,
    "helpText" TEXT,
    "evidencePrompt" TEXT,
    "weight" INTEGER NOT NULL DEFAULT 1,
    "requiresEvidence" BOOLEAN NOT NULL DEFAULT false,
    "requiresAttestation" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TruvernControlQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TruvernFrameworkAssessment" (
    "id" SERIAL NOT NULL,
    "frameworkId" INTEGER NOT NULL,
    "organizationId" INTEGER,
    "vendorId" INTEGER,
    "assessmentRunId" INTEGER,
    "reviewAssignmentId" INTEGER,
    "title" TEXT NOT NULL,
    "status" "TruvernAssessmentLifecycleStatus" NOT NULL DEFAULT 'DRAFT',
    "score" INTEGER,
    "maxScore" INTEGER,
    "riskLevel" TEXT,
    "sentAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "remediationDueAt" TIMESTAMP(3),
    "readyForReleaseAt" TIMESTAMP(3),
    "releasedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TruvernFrameworkAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TruvernAssessmentResponse" (
    "id" SERIAL NOT NULL,
    "assessmentId" INTEGER NOT NULL,
    "questionId" INTEGER NOT NULL,
    "answer" JSONB,
    "score" INTEGER,
    "reviewerNotes" TEXT,
    "vendorNotes" TEXT,
    "evidence" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TruvernAssessmentResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TruvernAssessmentFinding" (
    "id" SERIAL NOT NULL,
    "assessmentId" INTEGER NOT NULL,
    "controlId" INTEGER,
    "severity" "TruvernFindingSeverity" NOT NULL,
    "status" "TruvernFindingStatus" NOT NULL DEFAULT 'OPEN',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "recommendation" TEXT,
    "evidenceSummary" TEXT,
    "remediationRequired" BOOLEAN NOT NULL DEFAULT false,
    "attestationRequired" BOOLEAN NOT NULL DEFAULT false,
    "dueAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TruvernAssessmentFinding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TruvernRemediationRequest" (
    "id" SERIAL NOT NULL,
    "findingId" INTEGER NOT NULL,
    "status" "TruvernRemediationStatus" NOT NULL DEFAULT 'REQUESTED',
    "requestText" TEXT NOT NULL,
    "vendorResponse" TEXT,
    "reviewerDecision" TEXT,
    "dueAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TruvernRemediationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TruvernAssessmentAttestation" (
    "id" SERIAL NOT NULL,
    "assessmentId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "requestedBy" TEXT,
    "submittedBy" TEXT,
    "status" "TruvernAttestationStatus" NOT NULL DEFAULT 'REQUESTED',
    "evidence" JSONB,
    "expiresAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TruvernAssessmentAttestation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorGovernanceMemory" (
    "id" SERIAL NOT NULL,
    "vendorId" INTEGER NOT NULL,
    "reviewAssignmentId" INTEGER,
    "governanceScore" INTEGER,
    "governanceDecision" TEXT,
    "residualRisk" TEXT,
    "criticalFailures" INTEGER NOT NULL DEFAULT 0,
    "partialControls" INTEGER NOT NULL DEFAULT 0,
    "missingEvidenceCount" INTEGER NOT NULL DEFAULT 0,
    "remediationCount" INTEGER NOT NULL DEFAULT 0,
    "breachDisclosureDetected" BOOLEAN NOT NULL DEFAULT false,
    "federalInvestigationDetected" BOOLEAN NOT NULL DEFAULT false,
    "governanceNarrative" TEXT,
    "reviewerConditions" JSONB,
    "attestationRequests" JSONB,
    "releaseConditions" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VendorGovernanceMemory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewRequest" (
    "id" SERIAL NOT NULL,
    "organizationId" INTEGER,
    "vendorId" INTEGER,
    "kind" TEXT,
    "title" TEXT,
    "status" TEXT DEFAULT 'REQUESTED',
    "dueAt" TIMESTAMP(6),
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assessmentId" INTEGER,
    "note" TEXT,

    CONSTRAINT "ReviewRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewResponse" (
    "id" SERIAL NOT NULL,
    "reviewAssignmentId" INTEGER,
    "responses" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "organizationId" INTEGER,
    "reviewRequestId" INTEGER,
    "draftSavedAt" TIMESTAMP(6),
    "submittedAt" TIMESTAMP(6),

    CONSTRAINT "ReviewResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TruvernCreditLedgerEntry" (
    "id" SERIAL NOT NULL,
    "organizationId" INTEGER,
    "entryType" TEXT,
    "fundingSource" TEXT,
    "note" TEXT,
    "availableDelta" INTEGER NOT NULL DEFAULT 0,
    "reservedDelta" INTEGER NOT NULL DEFAULT 0,
    "consumedDelta" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT DEFAULT 'POSTED',
    "metadataJson" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "quantity" INTEGER DEFAULT 0,
    "reviewAssignmentId" INTEGER,
    "reviewRequestId" INTEGER,
    "vendorId" INTEGER,
    "eventKey" TEXT,

    CONSTRAINT "TruvernCreditLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowInstance" (
    "id" SERIAL NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "vendorId" INTEGER,
    "assessmentId" INTEGER,
    "reviewAssignmentId" INTEGER,
    "type" TEXT NOT NULL DEFAULT 'VENDOR_GOVERNANCE_REVIEW',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "currentStage" TEXT NOT NULL DEFAULT 'ASSESSMENT_REVIEW',
    "slaDueAt" TIMESTAMP(6),
    "payload" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkflowInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowQueueItem" (
    "id" SERIAL NOT NULL,
    "workflowId" INTEGER,
    "organizationId" INTEGER NOT NULL,
    "vendorId" INTEGER,
    "assessmentId" INTEGER,
    "reviewAssignmentId" INTEGER,
    "queue" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "priority" INTEGER NOT NULL DEFAULT 50,
    "assignedTo" TEXT,
    "availableAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueAt" TIMESTAMP(6),
    "payload" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkflowQueueItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowTask" (
    "id" SERIAL NOT NULL,
    "workflowId" INTEGER,
    "queueItemId" INTEGER,
    "packageId" INTEGER,
    "reviewAssignmentId" INTEGER,
    "vendorId" INTEGER,
    "organizationId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "priority" INTEGER NOT NULL DEFAULT 50,
    "assignedTo" TEXT,
    "assignedReviewerName" TEXT,
    "slaDueAt" TIMESTAMP(6),
    "startedAt" TIMESTAMP(6),
    "completedAt" TIMESTAMP(6),
    "estimatedMinutes" INTEGER,
    "result" TEXT,
    "notes" TEXT,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkflowTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowEvent" (
    "id" SERIAL NOT NULL,
    "workflowId" INTEGER,
    "organizationId" INTEGER NOT NULL,
    "vendorId" INTEGER,
    "assessmentId" INTEGER,
    "reviewAssignmentId" INTEGER,
    "type" TEXT NOT NULL,
    "actor" TEXT,
    "summary" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkflowEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RemediationPackage" (
    "id" SERIAL NOT NULL,
    "reviewAssignmentId" INTEGER NOT NULL,
    "vendorId" INTEGER NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "evidenceRequestId" INTEGER,
    "sourceKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "severity" TEXT,
    "dueAt" TIMESTAMP(6),
    "payload" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RemediationPackage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RemediationTask" (
    "id" SERIAL NOT NULL,
    "packageId" INTEGER NOT NULL,
    "workflowId" INTEGER,
    "reviewAssignmentId" INTEGER NOT NULL,
    "vendorId" INTEGER NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'EVIDENCE',
    "status" TEXT NOT NULL DEFAULT 'WAITING_FOR_VENDOR',
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "dueAt" TIMESTAMP(6),
    "completedAt" TIMESTAMP(6),
    "payload" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RemediationTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RemediationActivity" (
    "id" SERIAL NOT NULL,
    "packageId" INTEGER NOT NULL,
    "taskId" INTEGER,
    "workflowId" INTEGER,
    "reviewAssignmentId" INTEGER NOT NULL,
    "vendorId" INTEGER NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "actor" TEXT,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RemediationActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RemediationApproval" (
    "id" SERIAL NOT NULL,
    "packageId" INTEGER NOT NULL,
    "taskId" INTEGER,
    "workflowId" INTEGER,
    "reviewAssignmentId" INTEGER NOT NULL,
    "vendorId" INTEGER NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "decision" TEXT NOT NULL,
    "rationale" TEXT,
    "reviewerId" TEXT,
    "reviewerName" TEXT,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RemediationApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RemediationAttachment" (
    "id" SERIAL NOT NULL,
    "packageId" INTEGER NOT NULL,
    "taskId" INTEGER,
    "messageId" INTEGER,
    "workflowId" INTEGER,
    "evidenceId" INTEGER,
    "reviewAssignmentId" INTEGER NOT NULL,
    "vendorId" INTEGER NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "filename" TEXT NOT NULL,
    "fileUrl" TEXT,
    "storageKey" TEXT,
    "contentType" TEXT,
    "sizeBytes" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'UPLOADED',
    "reviewStatus" TEXT NOT NULL DEFAULT 'PENDING_REVIEW',
    "reviewComment" TEXT,
    "uploadedBy" TEXT,
    "uploadedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(6),
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RemediationAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RemediationMessage" (
    "id" SERIAL NOT NULL,
    "packageId" INTEGER NOT NULL,
    "taskId" INTEGER,
    "workflowId" INTEGER,
    "reviewAssignmentId" INTEGER NOT NULL,
    "vendorId" INTEGER NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "authorType" TEXT NOT NULL DEFAULT 'SYSTEM',
    "authorId" TEXT,
    "authorName" TEXT,
    "message" TEXT NOT NULL,
    "visibility" TEXT NOT NULL DEFAULT 'VENDOR_AND_TRUVERN',
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RemediationMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GovernanceTransparencyCheckpoint" (
    "id" SERIAL NOT NULL,
    "checkpointId" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
    "checkpointHash" TEXT,
    "merkleRoot" TEXT,
    "latestEntryHash" TEXT,
    "entryCount" INTEGER NOT NULL DEFAULT 0,
    "generatedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadataJson" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checkpointVersion" TEXT NOT NULL DEFAULT 'v1',
    "signature" TEXT,
    "signatureAlgorithm" TEXT,
    "publicKeyId" TEXT,
    "anchorUri" TEXT,
    "publishedAt" TIMESTAMP(6),

    CONSTRAINT "GovernanceTransparencyCheckpoint_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_clerkOrgId_key" ON "Organization"("clerkOrgId");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_name_key" ON "Organization"("name");

-- CreateIndex
CREATE INDEX "ReviewAssignment_organizationId_idx" ON "ReviewAssignment"("organizationId");

-- CreateIndex
CREATE INDEX "ReviewAssignment_vendorId_idx" ON "ReviewAssignment"("vendorId");

-- CreateIndex
CREATE INDEX "ReviewAssignment_reviewRequestId_idx" ON "ReviewAssignment"("reviewRequestId");

-- CreateIndex
CREATE INDEX "ReviewAssignment_reviewerUserId_idx" ON "ReviewAssignment"("reviewerUserId");

-- CreateIndex
CREATE INDEX "ReviewAssignment_assignmentType_idx" ON "ReviewAssignment"("assignmentType");

-- CreateIndex
CREATE INDEX "ReviewAssignment_status_idx" ON "ReviewAssignment"("status");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_clerkId_key" ON "User"("clerkId");

-- CreateIndex
CREATE UNIQUE INDEX "OrgMembership_userId_organizationId_key" ON "OrgMembership"("userId", "organizationId");

-- CreateIndex
CREATE INDEX "ActivityEvent_organizationId_createdAt_idx" ON "ActivityEvent"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "ActivityEvent_vendorId_createdAt_idx" ON "ActivityEvent"("vendorId", "createdAt");

-- CreateIndex
CREATE INDEX "ActivityEvent_type_createdAt_idx" ON "ActivityEvent"("type", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Vendor_slug_key" ON "Vendor"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Vendor_organizationId_name_key" ON "Vendor"("organizationId", "name");

-- CreateIndex
CREATE INDEX "VendorContact_vendorId_idx" ON "VendorContact"("vendorId");

-- CreateIndex
CREATE INDEX "VendorContact_vendorId_isPrimary_idx" ON "VendorContact"("vendorId", "isPrimary");

-- CreateIndex
CREATE UNIQUE INDEX "VendorContact_vendorId_email_key" ON "VendorContact"("vendorId", "email");

-- CreateIndex
CREATE INDEX "VendorRiskAlert_vendorId_type_resolvedAt_idx" ON "VendorRiskAlert"("vendorId", "type", "resolvedAt");

-- CreateIndex
CREATE UNIQUE INDEX "GovernanceTransparencyLog_entryId_key" ON "GovernanceTransparencyLog"("entryId");

-- CreateIndex
CREATE INDEX "GovernanceTransparencyLog_assignmentId_idx" ON "GovernanceTransparencyLog"("assignmentId");

-- CreateIndex
CREATE INDEX "GovernanceTransparencyLog_responseId_idx" ON "GovernanceTransparencyLog"("responseId");

-- CreateIndex
CREATE INDEX "GovernanceTransparencyLog_entryHash_idx" ON "GovernanceTransparencyLog"("entryHash");

-- CreateIndex
CREATE INDEX "GovernanceTransparencyLog_timestamp_idx" ON "GovernanceTransparencyLog"("timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "TrustProfile_vendorId_key" ON "TrustProfile"("vendorId");

-- CreateIndex
CREATE UNIQUE INDEX "TrustProfile_publicSlug_key" ON "TrustProfile"("publicSlug");

-- CreateIndex
CREATE UNIQUE INDEX "VendorShareToken_token_key" ON "VendorShareToken"("token");

-- CreateIndex
CREATE INDEX "VendorShareToken_vendorId_idx" ON "VendorShareToken"("vendorId");

-- CreateIndex
CREATE INDEX "VendorShareToken_expiresAt_idx" ON "VendorShareToken"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "TrustLink_token_key" ON "TrustLink"("token");

-- CreateIndex
CREATE INDEX "EvidenceRequest_vendorId_status_idx" ON "EvidenceRequest"("vendorId", "status");

-- CreateIndex
CREATE INDEX "EvidenceRequest_organizationId_idx" ON "EvidenceRequest"("organizationId");

-- CreateIndex
CREATE INDEX "EvidenceRequestIteration_evidenceRequestId_submittedAt_idx" ON "EvidenceRequestIteration"("evidenceRequestId", "submittedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentTemplate_code_key" ON "AssessmentTemplate"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Assessment_token_key" ON "Assessment"("token");

-- CreateIndex
CREATE INDEX "IssueEvent_issueId_createdAt_idx" ON "IssueEvent"("issueId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentAnswer_assessmentId_questionId_key" ON "AssessmentAnswer"("assessmentId", "questionId");

-- CreateIndex
CREATE INDEX "Evidence_evidenceRequestId_idx" ON "Evidence"("evidenceRequestId");

-- CreateIndex
CREATE INDEX "Evidence_iterationId_idx" ON "Evidence"("iterationId");

-- CreateIndex
CREATE INDEX "Issue_organizationId_vendorId_idx" ON "Issue"("organizationId", "vendorId");

-- CreateIndex
CREATE INDEX "Issue_status_severity_idx" ON "Issue"("status", "severity");

-- CreateIndex
CREATE INDEX "Issue_dueAt_idx" ON "Issue"("dueAt");

-- CreateIndex
CREATE UNIQUE INDEX "BillingPlan_tier_key" ON "BillingPlan"("tier");

-- CreateIndex
CREATE UNIQUE INDEX "BillingPlan_stripePriceId_key" ON "BillingPlan"("stripePriceId");

-- CreateIndex
CREATE INDEX "VendorRiskSnapshot_vendorId_takenAt_idx" ON "VendorRiskSnapshot"("vendorId", "takenAt");

-- CreateIndex
CREATE UNIQUE INDEX "VendorPortalUser_clerkUserId_key" ON "VendorPortalUser"("clerkUserId");

-- CreateIndex
CREATE INDEX "VendorPortalUser_organizationId_idx" ON "VendorPortalUser"("organizationId");

-- CreateIndex
CREATE INDEX "VendorPortalUser_vendorId_idx" ON "VendorPortalUser"("vendorId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_stripeCustomerId_key" ON "Subscription"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_stripeSubId_key" ON "Subscription"("stripeSubId");

-- CreateIndex
CREATE INDEX "UsageEvent_organizationId_kind_createdAt_idx" ON "UsageEvent"("organizationId", "kind", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "InviteToken_token_key" ON "InviteToken"("token");

-- CreateIndex
CREATE INDEX "InviteToken_organizationId_email_idx" ON "InviteToken"("organizationId", "email");

-- CreateIndex
CREATE INDEX "AssessmentRun_organizationId_id_idx" ON "AssessmentRun"("organizationId", "id");

-- CreateIndex
CREATE INDEX "AssessmentRun_organizationId_vendorId_idx" ON "AssessmentRun"("organizationId", "vendorId");

-- CreateIndex
CREATE INDEX "AssessmentRun_organizationId_assessmentId_idx" ON "AssessmentRun"("organizationId", "assessmentId");

-- CreateIndex
CREATE INDEX "AssessmentRun_status_idx" ON "AssessmentRun"("status");

-- CreateIndex
CREATE INDEX "GovernanceReleaseManifest_organizationId_idx" ON "GovernanceReleaseManifest"("organizationId");

-- CreateIndex
CREATE INDEX "GovernanceReleaseManifest_vendorId_idx" ON "GovernanceReleaseManifest"("vendorId");

-- CreateIndex
CREATE INDEX "GovernanceReleaseManifest_reviewAssignmentId_idx" ON "GovernanceReleaseManifest"("reviewAssignmentId");

-- CreateIndex
CREATE INDEX "OrganizationPlanOverride_organizationId_idx" ON "OrganizationPlanOverride"("organizationId");

-- CreateIndex
CREATE INDEX "OrganizationPlanOverride_planTier_idx" ON "OrganizationPlanOverride"("planTier");

-- CreateIndex
CREATE INDEX "OrganizationPlanOverride_startsAt_idx" ON "OrganizationPlanOverride"("startsAt");

-- CreateIndex
CREATE INDEX "OrganizationPlanOverride_expiresAt_idx" ON "OrganizationPlanOverride"("expiresAt");

-- CreateIndex
CREATE INDEX "OrganizationPlanOverride_revokedAt_idx" ON "OrganizationPlanOverride"("revokedAt");

-- CreateIndex
CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");

-- CreateIndex
CREATE INDEX "Notification_organizationId_idx" ON "Notification"("organizationId");

-- CreateIndex
CREATE INDEX "Notification_type_idx" ON "Notification"("type");

-- CreateIndex
CREATE INDEX "Notification_severity_idx" ON "Notification"("severity");

-- CreateIndex
CREATE INDEX "Notification_readAt_idx" ON "Notification"("readAt");

-- CreateIndex
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TruvernFramework_slug_key" ON "TruvernFramework"("slug");

-- CreateIndex
CREATE INDEX "TruvernFramework_status_idx" ON "TruvernFramework"("status");

-- CreateIndex
CREATE INDEX "TruvernFramework_slug_idx" ON "TruvernFramework"("slug");

-- CreateIndex
CREATE INDEX "TruvernControl_frameworkId_idx" ON "TruvernControl"("frameworkId");

-- CreateIndex
CREATE INDEX "TruvernControl_family_idx" ON "TruvernControl"("family");

-- CreateIndex
CREATE INDEX "TruvernControl_controlId_idx" ON "TruvernControl"("controlId");

-- CreateIndex
CREATE UNIQUE INDEX "TruvernControl_frameworkId_controlId_key" ON "TruvernControl"("frameworkId", "controlId");

-- CreateIndex
CREATE INDEX "TruvernControlQuestion_controlId_idx" ON "TruvernControlQuestion"("controlId");

-- CreateIndex
CREATE INDEX "TruvernFrameworkAssessment_frameworkId_idx" ON "TruvernFrameworkAssessment"("frameworkId");

-- CreateIndex
CREATE INDEX "TruvernFrameworkAssessment_organizationId_idx" ON "TruvernFrameworkAssessment"("organizationId");

-- CreateIndex
CREATE INDEX "TruvernFrameworkAssessment_vendorId_idx" ON "TruvernFrameworkAssessment"("vendorId");

-- CreateIndex
CREATE INDEX "TruvernFrameworkAssessment_assessmentRunId_idx" ON "TruvernFrameworkAssessment"("assessmentRunId");

-- CreateIndex
CREATE INDEX "TruvernFrameworkAssessment_reviewAssignmentId_idx" ON "TruvernFrameworkAssessment"("reviewAssignmentId");

-- CreateIndex
CREATE INDEX "TruvernFrameworkAssessment_status_idx" ON "TruvernFrameworkAssessment"("status");

-- CreateIndex
CREATE INDEX "TruvernAssessmentResponse_assessmentId_idx" ON "TruvernAssessmentResponse"("assessmentId");

-- CreateIndex
CREATE INDEX "TruvernAssessmentResponse_questionId_idx" ON "TruvernAssessmentResponse"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "TruvernAssessmentResponse_assessmentId_questionId_key" ON "TruvernAssessmentResponse"("assessmentId", "questionId");

-- CreateIndex
CREATE INDEX "TruvernAssessmentFinding_assessmentId_idx" ON "TruvernAssessmentFinding"("assessmentId");

-- CreateIndex
CREATE INDEX "TruvernAssessmentFinding_controlId_idx" ON "TruvernAssessmentFinding"("controlId");

-- CreateIndex
CREATE INDEX "TruvernAssessmentFinding_severity_idx" ON "TruvernAssessmentFinding"("severity");

-- CreateIndex
CREATE INDEX "TruvernAssessmentFinding_status_idx" ON "TruvernAssessmentFinding"("status");

-- CreateIndex
CREATE INDEX "TruvernRemediationRequest_findingId_idx" ON "TruvernRemediationRequest"("findingId");

-- CreateIndex
CREATE INDEX "TruvernRemediationRequest_status_idx" ON "TruvernRemediationRequest"("status");

-- CreateIndex
CREATE INDEX "TruvernAssessmentAttestation_assessmentId_idx" ON "TruvernAssessmentAttestation"("assessmentId");

-- CreateIndex
CREATE INDEX "TruvernAssessmentAttestation_status_idx" ON "TruvernAssessmentAttestation"("status");

-- CreateIndex
CREATE INDEX "VendorGovernanceMemory_vendorId_createdAt_idx" ON "VendorGovernanceMemory"("vendorId", "createdAt");

-- CreateIndex
CREATE INDEX "VendorGovernanceMemory_reviewAssignmentId_idx" ON "VendorGovernanceMemory"("reviewAssignmentId");

-- CreateIndex
CREATE INDEX "idx_workflow_instance_assignment" ON "WorkflowInstance"("reviewAssignmentId");

-- CreateIndex
CREATE INDEX "idx_workflow_instance_org_status" ON "WorkflowInstance"("organizationId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "idx_workflow_queue_assignment" ON "WorkflowQueueItem"("reviewAssignmentId", "status");

-- CreateIndex
CREATE INDEX "idx_workflow_queue_open" ON "WorkflowQueueItem"("queue", "status", "priority" DESC, "dueAt", "availableAt");

-- CreateIndex
CREATE INDEX "idx_workflow_task_assignee" ON "WorkflowTask"("assignedTo", "status");

-- CreateIndex
CREATE INDEX "idx_workflow_task_package" ON "WorkflowTask"("packageId", "status");

-- CreateIndex
CREATE INDEX "idx_workflow_task_queue" ON "WorkflowTask"("status", "priority" DESC, "slaDueAt", "updatedAt");

-- CreateIndex
CREATE INDEX "idx_workflow_task_workflow" ON "WorkflowTask"("workflowId", "status");

-- CreateIndex
CREATE INDEX "idx_workflow_event_workflow" ON "WorkflowEvent"("workflowId", "createdAt");

-- CreateIndex
CREATE INDEX "RemediationPackage_vendor_status_idx" ON "RemediationPackage"("vendorId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "RemediationPackage_assignment_source_unique" ON "RemediationPackage"("reviewAssignmentId", "sourceKey");

-- CreateIndex
CREATE INDEX "idx_remediation_task_package_status" ON "RemediationTask"("packageId", "status");

-- CreateIndex
CREATE INDEX "idx_remediation_task_queue" ON "RemediationTask"("status", "priority", "dueAt", "updatedAt");

-- CreateIndex
CREATE INDEX "idx_remediation_activity_package" ON "RemediationActivity"("packageId", "createdAt");

-- CreateIndex
CREATE INDEX "idx_remediation_attachment_package" ON "RemediationAttachment"("packageId", "reviewStatus", "uploadedAt");

-- CreateIndex
CREATE INDEX "idx_remediation_message_package" ON "RemediationMessage"("packageId", "createdAt");

-- CreateIndex
CREATE INDEX "GovernanceTransparencyCheckpoint_generatedAt_idx" ON "GovernanceTransparencyCheckpoint"("generatedAt" DESC);

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgMembership" ADD CONSTRAINT "OrgMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgMembership" ADD CONSTRAINT "OrgMembership_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityEvent" ADD CONSTRAINT "ActivityEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityEvent" ADD CONSTRAINT "ActivityEvent_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vendor" ADD CONSTRAINT "Vendor_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorContact" ADD CONSTRAINT "VendorContact_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorRiskAlert" ADD CONSTRAINT "VendorRiskAlert_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrustProfile" ADD CONSTRAINT "TrustProfile_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrustProfile" ADD CONSTRAINT "TrustProfile_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorShareToken" ADD CONSTRAINT "VendorShareToken_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrustLink" ADD CONSTRAINT "TrustLink_trustProfileId_fkey" FOREIGN KEY ("trustProfileId") REFERENCES "TrustProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceRequest" ADD CONSTRAINT "EvidenceRequest_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceRequest" ADD CONSTRAINT "EvidenceRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceRequestIteration" ADD CONSTRAINT "EvidenceRequestIteration_evidenceRequestId_fkey" FOREIGN KEY ("evidenceRequestId") REFERENCES "EvidenceRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentTemplate" ADD CONSTRAINT "AssessmentTemplate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentSection" ADD CONSTRAINT "AssessmentSection_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "AssessmentTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentQuestion" ADD CONSTRAINT "AssessmentQuestion_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "AssessmentTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentQuestion" ADD CONSTRAINT "AssessmentQuestion_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "AssessmentSection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "AssessmentTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IssueEvent" ADD CONSTRAINT "IssueEvent_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "Issue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentAnswer" ADD CONSTRAINT "AssessmentAnswer_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentAnswer" ADD CONSTRAINT "AssessmentAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "AssessmentQuestion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_evidenceRequestId_fkey" FOREIGN KEY ("evidenceRequestId") REFERENCES "EvidenceRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_iterationId_fkey" FOREIGN KEY ("iterationId") REFERENCES "EvidenceRequestIteration"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Issue" ADD CONSTRAINT "Issue_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Issue" ADD CONSTRAINT "Issue_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Issue" ADD CONSTRAINT "Issue_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Issue" ADD CONSTRAINT "Issue_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Issue" ADD CONSTRAINT "Issue_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorRiskSnapshot" ADD CONSTRAINT "VendorRiskSnapshot_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorPortalUser" ADD CONSTRAINT "VendorPortalUser_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorPortalUser" ADD CONSTRAINT "VendorPortalUser_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "BillingPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageEvent" ADD CONSTRAINT "UsageEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageEvent" ADD CONSTRAINT "UsageEvent_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InviteToken" ADD CONSTRAINT "InviteToken_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentRun" ADD CONSTRAINT "AssessmentRun_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentRun" ADD CONSTRAINT "AssessmentRun_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentRun" ADD CONSTRAINT "AssessmentRun_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationPlanOverride" ADD CONSTRAINT "OrganizationPlanOverride_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TruvernControl" ADD CONSTRAINT "TruvernControl_frameworkId_fkey" FOREIGN KEY ("frameworkId") REFERENCES "TruvernFramework"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TruvernControlQuestion" ADD CONSTRAINT "TruvernControlQuestion_controlId_fkey" FOREIGN KEY ("controlId") REFERENCES "TruvernControl"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TruvernFrameworkAssessment" ADD CONSTRAINT "TruvernFrameworkAssessment_frameworkId_fkey" FOREIGN KEY ("frameworkId") REFERENCES "TruvernFramework"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TruvernAssessmentResponse" ADD CONSTRAINT "TruvernAssessmentResponse_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "TruvernFrameworkAssessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TruvernAssessmentResponse" ADD CONSTRAINT "TruvernAssessmentResponse_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "TruvernControlQuestion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TruvernAssessmentFinding" ADD CONSTRAINT "TruvernAssessmentFinding_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "TruvernFrameworkAssessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TruvernAssessmentFinding" ADD CONSTRAINT "TruvernAssessmentFinding_controlId_fkey" FOREIGN KEY ("controlId") REFERENCES "TruvernControl"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TruvernRemediationRequest" ADD CONSTRAINT "TruvernRemediationRequest_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "TruvernAssessmentFinding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TruvernAssessmentAttestation" ADD CONSTRAINT "TruvernAssessmentAttestation_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "TruvernFrameworkAssessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorGovernanceMemory" ADD CONSTRAINT "VendorGovernanceMemory_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowQueueItem" ADD CONSTRAINT "WorkflowQueueItem_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "WorkflowInstance"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "WorkflowTask" ADD CONSTRAINT "WorkflowTask_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "RemediationPackage"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "WorkflowTask" ADD CONSTRAINT "WorkflowTask_queueItemId_fkey" FOREIGN KEY ("queueItemId") REFERENCES "WorkflowQueueItem"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "WorkflowTask" ADD CONSTRAINT "WorkflowTask_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "WorkflowInstance"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "WorkflowEvent" ADD CONSTRAINT "WorkflowEvent_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "WorkflowInstance"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "RemediationTask" ADD CONSTRAINT "RemediationTask_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "RemediationPackage"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "RemediationTask" ADD CONSTRAINT "RemediationTask_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "WorkflowInstance"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "RemediationActivity" ADD CONSTRAINT "RemediationActivity_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "RemediationPackage"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "RemediationActivity" ADD CONSTRAINT "RemediationActivity_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "RemediationTask"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "RemediationActivity" ADD CONSTRAINT "RemediationActivity_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "WorkflowInstance"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "RemediationApproval" ADD CONSTRAINT "RemediationApproval_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "RemediationPackage"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "RemediationApproval" ADD CONSTRAINT "RemediationApproval_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "RemediationTask"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "RemediationApproval" ADD CONSTRAINT "RemediationApproval_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "WorkflowInstance"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "RemediationAttachment" ADD CONSTRAINT "RemediationAttachment_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "RemediationMessage"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "RemediationAttachment" ADD CONSTRAINT "RemediationAttachment_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "RemediationPackage"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "RemediationAttachment" ADD CONSTRAINT "RemediationAttachment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "RemediationTask"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "RemediationAttachment" ADD CONSTRAINT "RemediationAttachment_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "WorkflowInstance"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "RemediationMessage" ADD CONSTRAINT "RemediationMessage_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "RemediationPackage"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "RemediationMessage" ADD CONSTRAINT "RemediationMessage_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "RemediationTask"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "RemediationMessage" ADD CONSTRAINT "RemediationMessage_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "WorkflowInstance"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

