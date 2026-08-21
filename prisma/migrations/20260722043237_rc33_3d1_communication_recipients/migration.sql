-- CreateTable
CREATE TABLE "CommunicationRecipient" (
    "id" SERIAL NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "messageId" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "displayName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunicationRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CommunicationRecipient_organizationId_idx" ON "CommunicationRecipient"("organizationId");

-- CreateIndex
CREATE INDEX "CommunicationRecipient_messageId_idx" ON "CommunicationRecipient"("messageId");

-- CreateIndex
CREATE INDEX "CommunicationRecipient_organizationId_kind_idx" ON "CommunicationRecipient"("organizationId", "kind");

-- CreateIndex
CREATE INDEX "CommunicationRecipient_address_idx" ON "CommunicationRecipient"("address");

-- CreateIndex
CREATE UNIQUE INDEX "CommunicationRecipient_messageId_kind_address_key" ON "CommunicationRecipient"("messageId", "kind", "address");

-- AddForeignKey
ALTER TABLE "CommunicationRecipient" ADD CONSTRAINT "CommunicationRecipient_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "CommunicationMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
