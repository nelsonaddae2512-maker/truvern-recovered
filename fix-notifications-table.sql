DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'NotificationType') THEN
    CREATE TYPE "NotificationType" AS ENUM (
      'VENDOR_SUBMITTED',
      'REVIEW_ASSIGNED',
      'TRUVERN_RELEASE_READY',
      'TRUVERN_RELEASED',
      'RELEASE_CONFIRMATION_REQUIRED',
      'REASSESSMENT_DUE',
      'REASSESSMENT_OVERDUE',
      'LOW_CREDITS',
      'CREDITS_GRANTED',
      'PLAN_OVERRIDE_APPLIED',
      'PLAN_OVERRIDE_EXPIRING',
      'GOVERNANCE_SEAL_VERIFIED'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'NotificationSeverity') THEN
    CREATE TYPE "NotificationSeverity" AS ENUM (
      'INFO',
      'SUCCESS',
      'WARNING',
      'CRITICAL'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "Notification" (
  "id" SERIAL PRIMARY KEY
);

ALTER TABLE "Notification"
  ADD COLUMN IF NOT EXISTS "userId" TEXT,
  ADD COLUMN IF NOT EXISTS "organizationId" INTEGER,
  ADD COLUMN IF NOT EXISTS "type" "NotificationType" NOT NULL DEFAULT 'VENDOR_SUBMITTED',
  ADD COLUMN IF NOT EXISTS "severity" "NotificationSeverity" NOT NULL DEFAULT 'INFO',
  ADD COLUMN IF NOT EXISTS "title" TEXT NOT NULL DEFAULT 'Notification',
  ADD COLUMN IF NOT EXISTS "message" TEXT,
  ADD COLUMN IF NOT EXISTS "href" TEXT,
  ADD COLUMN IF NOT EXISTS "metadataJson" JSONB,
  ADD COLUMN IF NOT EXISTS "readAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS "Notification_userId_idx" ON "Notification"("userId");
CREATE INDEX IF NOT EXISTS "Notification_organizationId_idx" ON "Notification"("organizationId");
CREATE INDEX IF NOT EXISTS "Notification_type_idx" ON "Notification"("type");
CREATE INDEX IF NOT EXISTS "Notification_severity_idx" ON "Notification"("severity");
CREATE INDEX IF NOT EXISTS "Notification_readAt_idx" ON "Notification"("readAt");
CREATE INDEX IF NOT EXISTS "Notification_createdAt_idx" ON "Notification"("createdAt");
