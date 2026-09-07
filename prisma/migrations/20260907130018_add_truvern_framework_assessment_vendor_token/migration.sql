-- AlterTable
ALTER TABLE "TruvernFrameworkAssessment" ADD COLUMN     "vendorToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "TruvernFrameworkAssessment_vendorToken_key" ON "TruvernFrameworkAssessment"("vendorToken");
