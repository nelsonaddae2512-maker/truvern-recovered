-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "amountCents" INTEGER,
ADD COLUMN     "createdByUserId" TEXT,
ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'USD',
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "paidAt" TIMESTAMP(3),
ADD COLUMN     "paymentReference" TEXT,
ADD COLUMN     "paymentSource" TEXT NOT NULL DEFAULT 'STRIPE',
ADD COLUMN     "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "Subscription_organizationId_idx" ON "Subscription"("organizationId");

-- CreateIndex
CREATE INDEX "Subscription_status_idx" ON "Subscription"("status");

-- CreateIndex
CREATE INDEX "Subscription_paymentSource_idx" ON "Subscription"("paymentSource");

-- CreateIndex
CREATE INDEX "Subscription_startsAt_idx" ON "Subscription"("startsAt");

-- CreateIndex
CREATE INDEX "Subscription_currentPeriodEnd_idx" ON "Subscription"("currentPeriodEnd");
