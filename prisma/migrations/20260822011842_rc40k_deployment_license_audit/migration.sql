-- CreateEnum
CREATE TYPE "DeploymentLicenseAuditAction" AS ENUM ('ISSUED', 'SUSPENDED', 'REACTIVATED', 'REVOKED', 'EXPIRATION_UPDATED', 'KEY_ROTATED');

-- CreateTable
CREATE TABLE "DeploymentLicenseAudit" (
    "id" SERIAL NOT NULL,
    "deploymentLicenseId" INTEGER NOT NULL,
    "action" "DeploymentLicenseAuditAction" NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "reason" TEXT,
    "previousStatus" "DeploymentLicenseStatus",
    "newStatus" "DeploymentLicenseStatus",
    "previousExpiresAt" TIMESTAMP(3),
    "newExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "evidenceRequestId" INTEGER,
    "organizationPlanOverrideId" INTEGER,

    CONSTRAINT "DeploymentLicenseAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DeploymentLicenseAudit_deploymentLicenseId_idx" ON "DeploymentLicenseAudit"("deploymentLicenseId");

-- CreateIndex
CREATE INDEX "DeploymentLicenseAudit_action_idx" ON "DeploymentLicenseAudit"("action");

-- CreateIndex
CREATE INDEX "DeploymentLicenseAudit_actorUserId_idx" ON "DeploymentLicenseAudit"("actorUserId");

-- CreateIndex
CREATE INDEX "DeploymentLicenseAudit_createdAt_idx" ON "DeploymentLicenseAudit"("createdAt");

-- AddForeignKey
ALTER TABLE "DeploymentLicenseAudit" ADD CONSTRAINT "DeploymentLicenseAudit_deploymentLicenseId_fkey" FOREIGN KEY ("deploymentLicenseId") REFERENCES "DeploymentLicense"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeploymentLicenseAudit" ADD CONSTRAINT "DeploymentLicenseAudit_evidenceRequestId_fkey" FOREIGN KEY ("evidenceRequestId") REFERENCES "EvidenceRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeploymentLicenseAudit" ADD CONSTRAINT "DeploymentLicenseAudit_organizationPlanOverrideId_fkey" FOREIGN KEY ("organizationPlanOverrideId") REFERENCES "OrganizationPlanOverride"("id") ON DELETE SET NULL ON UPDATE CASCADE;
