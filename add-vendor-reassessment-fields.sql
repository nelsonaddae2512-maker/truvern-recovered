ALTER TABLE "Vendor"
  ADD COLUMN IF NOT EXISTS "lastAssessmentCompletedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "nextReviewDueAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "reviewCadenceDays" INTEGER;

CREATE INDEX IF NOT EXISTS "Vendor_nextReviewDueAt_idx"
  ON "Vendor"("nextReviewDueAt");

CREATE INDEX IF NOT EXISTS "Vendor_lastAssessmentCompletedAt_idx"
  ON "Vendor"("lastAssessmentCompletedAt");
