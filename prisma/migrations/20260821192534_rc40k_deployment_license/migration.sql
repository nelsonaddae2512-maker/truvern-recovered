-- CreateEnum
CREATE TYPE "DeploymentLicenseType" AS ENUM ('SAAS', 'MANAGED_PRIVATE', 'CUSTOMER_PRIVATE');

-- CreateEnum
CREATE TYPE "DeploymentLicenseStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'REVOKED', 'EXPIRED');

-- CreateTable
CREATE TABLE "DeploymentLicense" (
    "id" SERIAL NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "licenseKeyHash" TEXT NOT NULL,
    "deploymentId" TEXT NOT NULL,
    "type" "DeploymentLicenseType" NOT NULL,
    "status" "DeploymentLicenseStatus" NOT NULL DEFAULT 'PENDING',
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "environment" TEXT,
    "hostname" TEXT,
    "createdByUserId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeploymentLicense_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DeploymentLicense_licenseKeyHash_key" ON "DeploymentLicense"("licenseKeyHash");

-- CreateIndex
CREATE UNIQUE INDEX "DeploymentLicense_deploymentId_key" ON "DeploymentLicense"("deploymentId");

-- CreateIndex
CREATE INDEX "DeploymentLicense_organizationId_idx" ON "DeploymentLicense"("organizationId");

-- CreateIndex
CREATE INDEX "DeploymentLicense_status_idx" ON "DeploymentLicense"("status");

-- CreateIndex
CREATE INDEX "DeploymentLicense_type_idx" ON "DeploymentLicense"("type");

-- CreateIndex
CREATE INDEX "DeploymentLicense_startsAt_idx" ON "DeploymentLicense"("startsAt");

-- CreateIndex
CREATE INDEX "DeploymentLicense_expiresAt_idx" ON "DeploymentLicense"("expiresAt");

-- CreateIndex
CREATE INDEX "DeploymentLicense_revokedAt_idx" ON "DeploymentLicense"("revokedAt");

-- AddForeignKey
ALTER TABLE "DeploymentLicense" ADD CONSTRAINT "DeploymentLicense_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
