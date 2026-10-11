-- R38E.16F.2
-- Preserve vendor references in assessment history.
-- Forward-only migration.
-- AssessmentRun.vendorId remains nullable.

ALTER TABLE "AssessmentRun"
DROP CONSTRAINT "AssessmentRun_vendorId_fkey";

ALTER TABLE "AssessmentRun"
ADD CONSTRAINT "AssessmentRun_vendorId_fkey"
FOREIGN KEY ("vendorId")
REFERENCES "Vendor"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;