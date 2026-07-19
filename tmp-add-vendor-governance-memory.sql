CREATE TABLE IF NOT EXISTS "VendorGovernanceMemory" (
  "id" SERIAL PRIMARY KEY,
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
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'VendorGovernanceMemory_vendorId_fkey'
  ) THEN
    ALTER TABLE "VendorGovernanceMemory"
    ADD CONSTRAINT "VendorGovernanceMemory_vendorId_fkey"
    FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "VendorGovernanceMemory_vendorId_createdAt_idx"
ON "VendorGovernanceMemory"("vendorId", "createdAt");

CREATE INDEX IF NOT EXISTS "VendorGovernanceMemory_reviewAssignmentId_idx"
ON "VendorGovernanceMemory"("reviewAssignmentId");