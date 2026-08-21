-- CreateTable
CREATE TABLE "CommunicationMailbox" (
    "id" SERIAL NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "description" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunicationMailbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunicationConversation" (
    "id" SERIAL NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "mailboxId" INTEGER NOT NULL,
    "vendorId" INTEGER,
    "assessmentId" INTEGER,
    "assessmentRunId" INTEGER,
    "reviewRequestId" INTEGER,
    "reviewAssignmentId" INTEGER,
    "subject" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "channel" TEXT NOT NULL DEFAULT 'EMAIL',
    "externalThreadId" TEXT,
    "lastMessageAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunicationConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunicationMessage" (
    "id" SERIAL NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "mailboxId" INTEGER NOT NULL,
    "conversationId" INTEGER NOT NULL,
    "direction" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'EMAIL',
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "subject" TEXT,
    "bodyText" TEXT,
    "bodyHtml" TEXT,
    "fromAddress" TEXT NOT NULL,
    "fromName" TEXT,
    "replyToAddress" TEXT,
    "provider" TEXT,
    "providerMessageId" TEXT,
    "internetMessageId" TEXT,
    "inReplyToMessageId" TEXT,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "queuedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunicationMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CommunicationMailbox_organizationId_idx" ON "CommunicationMailbox"("organizationId");

-- CreateIndex
CREATE INDEX "CommunicationMailbox_isActive_idx" ON "CommunicationMailbox"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "CommunicationMailbox_organizationId_address_key" ON "CommunicationMailbox"("organizationId", "address");

-- CreateIndex
CREATE INDEX "CommunicationConversation_organizationId_idx" ON "CommunicationConversation"("organizationId");

-- CreateIndex
CREATE INDEX "CommunicationConversation_mailboxId_idx" ON "CommunicationConversation"("mailboxId");

-- CreateIndex
CREATE INDEX "CommunicationConversation_organizationId_status_idx" ON "CommunicationConversation"("organizationId", "status");

-- CreateIndex
CREATE INDEX "CommunicationConversation_vendorId_idx" ON "CommunicationConversation"("vendorId");

-- CreateIndex
CREATE INDEX "CommunicationConversation_assessmentId_idx" ON "CommunicationConversation"("assessmentId");

-- CreateIndex
CREATE INDEX "CommunicationConversation_assessmentRunId_idx" ON "CommunicationConversation"("assessmentRunId");

-- CreateIndex
CREATE INDEX "CommunicationConversation_reviewRequestId_idx" ON "CommunicationConversation"("reviewRequestId");

-- CreateIndex
CREATE INDEX "CommunicationConversation_reviewAssignmentId_idx" ON "CommunicationConversation"("reviewAssignmentId");

-- CreateIndex
CREATE INDEX "CommunicationConversation_lastMessageAt_idx" ON "CommunicationConversation"("lastMessageAt");

-- CreateIndex
CREATE INDEX "CommunicationConversation_externalThreadId_idx" ON "CommunicationConversation"("externalThreadId");

-- CreateIndex
CREATE INDEX "CommunicationMessage_organizationId_idx" ON "CommunicationMessage"("organizationId");

-- CreateIndex
CREATE INDEX "CommunicationMessage_mailboxId_idx" ON "CommunicationMessage"("mailboxId");

-- CreateIndex
CREATE INDEX "CommunicationMessage_conversationId_idx" ON "CommunicationMessage"("conversationId");

-- CreateIndex
CREATE INDEX "CommunicationMessage_conversationId_createdAt_idx" ON "CommunicationMessage"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "CommunicationMessage_organizationId_status_idx" ON "CommunicationMessage"("organizationId", "status");

-- CreateIndex
CREATE INDEX "CommunicationMessage_direction_idx" ON "CommunicationMessage"("direction");

-- CreateIndex
CREATE INDEX "CommunicationMessage_providerMessageId_idx" ON "CommunicationMessage"("providerMessageId");

-- CreateIndex
CREATE INDEX "CommunicationMessage_internetMessageId_idx" ON "CommunicationMessage"("internetMessageId");

-- CreateIndex
CREATE INDEX "CommunicationMessage_sentAt_idx" ON "CommunicationMessage"("sentAt");

-- CreateIndex
CREATE INDEX "CommunicationMessage_receivedAt_idx" ON "CommunicationMessage"("receivedAt");

-- AddForeignKey
ALTER TABLE "CommunicationMailbox" ADD CONSTRAINT "CommunicationMailbox_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationConversation" ADD CONSTRAINT "CommunicationConversation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationConversation" ADD CONSTRAINT "CommunicationConversation_mailboxId_fkey" FOREIGN KEY ("mailboxId") REFERENCES "CommunicationMailbox"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationMessage" ADD CONSTRAINT "CommunicationMessage_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationMessage" ADD CONSTRAINT "CommunicationMessage_mailboxId_fkey" FOREIGN KEY ("mailboxId") REFERENCES "CommunicationMailbox"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationMessage" ADD CONSTRAINT "CommunicationMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "CommunicationConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
