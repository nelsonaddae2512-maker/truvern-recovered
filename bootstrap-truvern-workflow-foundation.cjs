const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  console.log("Creating Truvern Workflow Foundation tables...");

  await prisma.$executeRawUnsafe(`
    create table if not exists "WorkflowInstance" (
      id serial primary key,
      "organizationId" integer not null,
      "vendorId" integer,
      "assessmentId" integer,
      "reviewAssignmentId" integer,
      type text not null default 'VENDOR_GOVERNANCE_REVIEW',
      status text not null default 'ACTIVE',
      priority text not null default 'NORMAL',
      "currentStage" text not null default 'ASSESSMENT_REVIEW',
      "slaDueAt" timestamp,
      payload jsonb not null default '{}'::jsonb,
      "createdAt" timestamp not null default now(),
      "updatedAt" timestamp not null default now()
    )
  `);

  await prisma.$executeRawUnsafe(`
    create table if not exists "WorkflowEvent" (
      id serial primary key,
      "workflowId" integer references "WorkflowInstance"(id) on delete cascade,
      "organizationId" integer not null,
      "vendorId" integer,
      "assessmentId" integer,
      "reviewAssignmentId" integer,
      type text not null,
      actor text,
      summary text not null,
      payload jsonb not null default '{}'::jsonb,
      "createdAt" timestamp not null default now()
    )
  `);

  await prisma.$executeRawUnsafe(`
    create table if not exists "WorkflowQueueItem" (
      id serial primary key,
      "workflowId" integer references "WorkflowInstance"(id) on delete cascade,
      "organizationId" integer not null,
      "vendorId" integer,
      "assessmentId" integer,
      "reviewAssignmentId" integer,
      queue text not null,
      status text not null default 'OPEN',
      priority integer not null default 50,
      "assignedTo" text,
      "availableAt" timestamp not null default now(),
      "dueAt" timestamp,
      payload jsonb not null default '{}'::jsonb,
      "createdAt" timestamp not null default now(),
      "updatedAt" timestamp not null default now()
    )
  `);

  await prisma.$executeRawUnsafe(`
    create table if not exists "RemediationTask" (
      id serial primary key,
      "packageId" integer not null references "RemediationPackage"(id) on delete cascade,
      "workflowId" integer references "WorkflowInstance"(id) on delete set null,
      "reviewAssignmentId" integer not null,
      "vendorId" integer not null,
      "organizationId" integer not null,
      title text not null,
      description text,
      kind text not null default 'EVIDENCE',
      status text not null default 'WAITING_FOR_VENDOR',
      priority text not null default 'NORMAL',
      "dueAt" timestamp,
      "completedAt" timestamp,
      payload jsonb not null default '{}'::jsonb,
      "createdAt" timestamp not null default now(),
      "updatedAt" timestamp not null default now()
    )
  `);

  await prisma.$executeRawUnsafe(`
    create table if not exists "RemediationMessage" (
      id serial primary key,
      "packageId" integer not null references "RemediationPackage"(id) on delete cascade,
      "taskId" integer references "RemediationTask"(id) on delete set null,
      "workflowId" integer references "WorkflowInstance"(id) on delete set null,
      "reviewAssignmentId" integer not null,
      "vendorId" integer not null,
      "organizationId" integer not null,
      "authorType" text not null default 'SYSTEM',
      "authorId" text,
      "authorName" text,
      message text not null,
      visibility text not null default 'VENDOR_AND_TRUVERN',
      "createdAt" timestamp not null default now()
    )
  `);

  await prisma.$executeRawUnsafe(`
    create table if not exists "RemediationAttachment" (
      id serial primary key,
      "packageId" integer not null references "RemediationPackage"(id) on delete cascade,
      "taskId" integer references "RemediationTask"(id) on delete set null,
      "messageId" integer references "RemediationMessage"(id) on delete set null,
      "workflowId" integer references "WorkflowInstance"(id) on delete set null,
      "evidenceId" integer,
      "reviewAssignmentId" integer not null,
      "vendorId" integer not null,
      "organizationId" integer not null,
      filename text not null,
      "fileUrl" text,
      "storageKey" text,
      "contentType" text,
      "sizeBytes" integer,
      status text not null default 'UPLOADED',
      "reviewStatus" text not null default 'PENDING_REVIEW',
      "reviewComment" text,
      "uploadedBy" text,
      "uploadedAt" timestamp not null default now(),
      "reviewedAt" timestamp,
      "createdAt" timestamp not null default now(),
      "updatedAt" timestamp not null default now()
    )
  `);

  await prisma.$executeRawUnsafe(`
    create table if not exists "RemediationApproval" (
      id serial primary key,
      "packageId" integer not null references "RemediationPackage"(id) on delete cascade,
      "taskId" integer references "RemediationTask"(id) on delete set null,
      "workflowId" integer references "WorkflowInstance"(id) on delete set null,
      "reviewAssignmentId" integer not null,
      "vendorId" integer not null,
      "organizationId" integer not null,
      decision text not null,
      rationale text,
      "reviewerId" text,
      "reviewerName" text,
      "createdAt" timestamp not null default now()
    )
  `);

  await prisma.$executeRawUnsafe(`
    create table if not exists "RemediationActivity" (
      id serial primary key,
      "packageId" integer not null references "RemediationPackage"(id) on delete cascade,
      "taskId" integer references "RemediationTask"(id) on delete set null,
      "workflowId" integer references "WorkflowInstance"(id) on delete set null,
      "reviewAssignmentId" integer not null,
      "vendorId" integer not null,
      "organizationId" integer not null,
      type text not null,
      summary text not null,
      actor text,
      payload jsonb not null default '{}'::jsonb,
      "createdAt" timestamp not null default now()
    )
  `);

  console.log("Creating indexes...");

  await prisma.$executeRawUnsafe(`create index if not exists "idx_workflow_instance_org_status" on "WorkflowInstance" ("organizationId", status, "updatedAt")`);
  await prisma.$executeRawUnsafe(`create index if not exists "idx_workflow_instance_assignment" on "WorkflowInstance" ("reviewAssignmentId")`);
  await prisma.$executeRawUnsafe(`create index if not exists "idx_workflow_event_workflow" on "WorkflowEvent" ("workflowId", "createdAt")`);
  await prisma.$executeRawUnsafe(`create index if not exists "idx_workflow_queue_open" on "WorkflowQueueItem" (queue, status, priority desc, "dueAt", "availableAt")`);
  await prisma.$executeRawUnsafe(`create index if not exists "idx_workflow_queue_assignment" on "WorkflowQueueItem" ("reviewAssignmentId", status)`);
  await prisma.$executeRawUnsafe(`create index if not exists "idx_remediation_task_package_status" on "RemediationTask" ("packageId", status)`);
  await prisma.$executeRawUnsafe(`create index if not exists "idx_remediation_task_queue" on "RemediationTask" (status, priority, "dueAt", "updatedAt")`);
  await prisma.$executeRawUnsafe(`create index if not exists "idx_remediation_message_package" on "RemediationMessage" ("packageId", "createdAt")`);
  await prisma.$executeRawUnsafe(`create index if not exists "idx_remediation_attachment_package" on "RemediationAttachment" ("packageId", "reviewStatus", "uploadedAt")`);
  await prisma.$executeRawUnsafe(`create index if not exists "idx_remediation_activity_package" on "RemediationActivity" ("packageId", "createdAt")`);

  console.log("Backfilling workflow instances for existing remediation packages...");

  await prisma.$executeRawUnsafe(`
    insert into "WorkflowInstance" (
      "organizationId",
      "vendorId",
      "reviewAssignmentId",
      type,
      status,
      priority,
      "currentStage",
      payload,
      "createdAt",
      "updatedAt"
    )
    select distinct
      rp."organizationId",
      rp."vendorId",
      rp."reviewAssignmentId",
      'VENDOR_GOVERNANCE_REVIEW',
      'ACTIVE',
      coalesce(rp.severity, 'NORMAL'),
      'VENDOR_REMEDIATION',
      jsonb_build_object('source', 'RemediationPackageBackfill'),
      min(rp."createdAt"),
      max(rp."updatedAt")
    from "RemediationPackage" rp
    where not exists (
      select 1
      from "WorkflowInstance" wi
      where wi."reviewAssignmentId" = rp."reviewAssignmentId"
        and wi."vendorId" = rp."vendorId"
        and wi.type = 'VENDOR_GOVERNANCE_REVIEW'
    )
    group by rp."organizationId", rp."vendorId", rp."reviewAssignmentId", coalesce(rp.severity, 'NORMAL')
  `);

  await prisma.$executeRawUnsafe(`
    insert into "RemediationActivity" (
      "packageId",
      "workflowId",
      "reviewAssignmentId",
      "vendorId",
      "organizationId",
      type,
      summary,
      actor,
      payload,
      "createdAt"
    )
    select
      rp.id,
      wi.id,
      rp."reviewAssignmentId",
      rp."vendorId",
      rp."organizationId",
      'PACKAGE_CREATED',
      'Remediation package created.',
      'SYSTEM',
      jsonb_build_object('sourceKey', rp."sourceKey", 'status', rp.status),
      coalesce(rp."createdAt", now())
    from "RemediationPackage" rp
    left join "WorkflowInstance" wi
      on wi."reviewAssignmentId" = rp."reviewAssignmentId"
     and wi."vendorId" = rp."vendorId"
     and wi.type = 'VENDOR_GOVERNANCE_REVIEW'
    where not exists (
      select 1
      from "RemediationActivity" ra
      where ra."packageId" = rp.id
        and ra.type = 'PACKAGE_CREATED'
    )
  `);

  await prisma.$executeRawUnsafe(`
    insert into "WorkflowQueueItem" (
      "workflowId",
      "organizationId",
      "vendorId",
      "reviewAssignmentId",
      queue,
      status,
      priority,
      "dueAt",
      payload,
      "createdAt",
      "updatedAt"
    )
    select
      wi.id,
      rp."organizationId",
      rp."vendorId",
      rp."reviewAssignmentId",
      case
        when upper(coalesce(rp.status, '')) in ('SUBMITTED', 'IN_REVIEW') then 'EVIDENCE_WAITING_REVIEW'
        when upper(coalesce(rp.status, '')) in ('APPROVED', 'COMPLETED', 'CLOSED') then 'READY_FOR_RELEASE_CHECK'
        else 'VENDOR_WAITING_RESPONSE'
      end,
      'OPEN',
      case
        when upper(coalesce(rp.severity, '')) = 'CRITICAL' then 100
        when upper(coalesce(rp.severity, '')) = 'HIGH' then 85
        when upper(coalesce(rp.severity, '')) = 'MEDIUM' then 60
        else 40
      end,
      rp."dueAt",
      jsonb_build_object('remediationPackageId', rp.id, 'packageTitle', rp.title),
      now(),
      now()
    from "RemediationPackage" rp
    left join "WorkflowInstance" wi
      on wi."reviewAssignmentId" = rp."reviewAssignmentId"
     and wi."vendorId" = rp."vendorId"
     and wi.type = 'VENDOR_GOVERNANCE_REVIEW'
    where not exists (
      select 1
      from "WorkflowQueueItem" qi
      where qi.payload->>'remediationPackageId' = rp.id::text
    )
  `);

  console.log("Truvern Workflow Foundation ready.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
}).finally(() => prisma.$disconnect());
