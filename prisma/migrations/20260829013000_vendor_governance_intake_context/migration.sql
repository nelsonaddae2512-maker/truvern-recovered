-- AlterTable
ALTER TABLE "Vendor"
ADD COLUMN "website" TEXT,
ADD COLUMN "dataAccess" JSONB,
ADD COLUMN "sensitiveData" JSONB,
ADD COLUMN "externalAccess" BOOLEAN,
ADD COLUMN "productionAccess" BOOLEAN,
ADD COLUMN "contactTitle" TEXT;

-- AlterTable
ALTER TABLE "VendorContact"
ADD COLUMN "title" TEXT;