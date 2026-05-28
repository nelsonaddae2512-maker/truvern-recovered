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
  "id" SERIAL PRIMARY KEY,
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
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "Notification_userId_idx" ON "Notification"("userId");
CREATE INDEX IF NOT EXISTS "Notification_organizationId_idx" ON "Notification"("organizationId");
CREATE INDEX IF NOT EXISTS "Notification_type_idx" ON "Notification"("type");
CREATE INDEX IF NOT EXISTS "Notification_severity_idx" ON "Notification"("severity");
CREATE INDEX IF NOT EXISTS "Notification_readAt_idx" ON "Notification"("readAt");
CREATE INDEX IF NOT EXISTS "Notification_createdAt_idx" ON "Notification"("createdAt");
