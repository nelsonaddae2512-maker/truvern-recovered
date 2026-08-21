-- CreateTable
CREATE TABLE "GovernanceDailyAnchor" (
    "id" SERIAL NOT NULL,
    "anchorDate" DATE NOT NULL,
    "anchorType" TEXT NOT NULL DEFAULT 'TRUVERN_DAILY_GOVERNANCE_MERKLE_ROOT',
    "version" TEXT NOT NULL DEFAULT 'TRV-MERKLE-ANCHOR-1.0',
    "entryCount" INTEGER NOT NULL,
    "merkleRoot" TEXT NOT NULL,
    "canonicalPayload" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "signatureAlgorithm" TEXT NOT NULL,
    "publicKeyId" TEXT NOT NULL,
    "signedAt" TIMESTAMP(6) NOT NULL,
    "generatedAt" TIMESTAMP(6) NOT NULL,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GovernanceDailyAnchor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GovernanceDailyAnchor_anchorDate_key" ON "GovernanceDailyAnchor"("anchorDate");

-- CreateIndex
CREATE INDEX "GovernanceDailyAnchor_generatedAt_idx" ON "GovernanceDailyAnchor"("generatedAt" DESC);

-- CreateIndex
CREATE INDEX "GovernanceDailyAnchor_publicKeyId_idx" ON "GovernanceDailyAnchor"("publicKeyId");

-- CreateIndex
CREATE INDEX "GovernanceDailyAnchor_merkleRoot_idx" ON "GovernanceDailyAnchor"("merkleRoot");
