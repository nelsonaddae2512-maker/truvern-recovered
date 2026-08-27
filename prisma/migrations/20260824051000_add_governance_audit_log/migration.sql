-- RC40L.7-F12-R46G.7G-D-A2
-- Generic non-blocking governance audit event persistence.

CREATE TABLE "AuditLog" (
    "id" SERIAL NOT NULL,

    "organizationId" INTEGER,
    "actorUserId" TEXT,

    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,

    "action" TEXT NOT NULL,
    "message" TEXT,

    "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,

    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey"
        PRIMARY KEY ("id")
);

CREATE INDEX
    "AuditLog_entityType_entityId_createdAt_idx"
ON
    "AuditLog"(
        "entityType",
        "entityId",
        "createdAt"
    );

CREATE INDEX
    "AuditLog_organizationId_createdAt_idx"
ON
    "AuditLog"(
        "organizationId",
        "createdAt"
    );

CREATE INDEX
    "AuditLog_actorUserId_createdAt_idx"
ON
    "AuditLog"(
        "actorUserId",
        "createdAt"
    );