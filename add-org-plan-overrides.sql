CREATE TABLE IF NOT EXISTS "OrganizationPlanOverride" (
  "id" SERIAL PRIMARY KEY,
  "organizationId" INTEGER NOT NULL,
  "planTier" TEXT NOT NULL,
  "reason" TEXT,
  "createdByUserId" TEXT,
  "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrganizationPlanOverride_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "OrganizationPlanOverride_organizationId_idx"
  ON "OrganizationPlanOverride"("organizationId");

CREATE INDEX IF NOT EXISTS "OrganizationPlanOverride_planTier_idx"
  ON "OrganizationPlanOverride"("planTier");

CREATE INDEX IF NOT EXISTS "OrganizationPlanOverride_startsAt_idx"
  ON "OrganizationPlanOverride"("startsAt");

CREATE INDEX IF NOT EXISTS "OrganizationPlanOverride_expiresAt_idx"
  ON "OrganizationPlanOverride"("expiresAt");

CREATE INDEX IF NOT EXISTS "OrganizationPlanOverride_revokedAt_idx"
  ON "OrganizationPlanOverride"("revokedAt");
