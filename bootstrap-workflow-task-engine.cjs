const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe(`
    create table if not exists "WorkflowTask" (
      id serial primary key,
      "workflowId" integer references "WorkflowInstance"(id) on delete cascade,
      "queueItemId" integer references "WorkflowQueueItem"(id) on delete set null,
      "packageId" integer references "RemediationPackage"(id) on delete cascade,
      "reviewAssignmentId" integer,
      "vendorId" integer,
      "organizationId" integer not null,
      type text not null,
      title text not null,
      description text,
      status text not null default 'OPEN',
      priority integer not null default 50,
      "assignedTo" text,
      "assignedReviewerName" text,
      "slaDueAt" timestamp,
      "startedAt" timestamp,
      "completedAt" timestamp,
      "estimatedMinutes" integer,
      result text,
      notes text,
      payload jsonb not null default '{}'::jsonb,
      "createdAt" timestamp not null default now(),
      "updatedAt" timestamp not null default now()
    )
  `);

  await prisma.$executeRawUnsafe(`
    create index if not exists "idx_workflow_task_queue"
    on "WorkflowTask" (status, priority desc, "slaDueAt", "updatedAt")
  `);

  await prisma.$executeRawUnsafe(`
    create index if not exists "idx_workflow_task_workflow"
    on "WorkflowTask" ("workflowId", status)
  `);

  await prisma.$executeRawUnsafe(`
    create index if not exists "idx_workflow_task_package"
    on "WorkflowTask" ("packageId", status)
  `);

  await prisma.$executeRawUnsafe(`
    create index if not exists "idx_workflow_task_assignee"
    on "WorkflowTask" ("assignedTo", status)
  `);

  console.log("WorkflowTask table ready.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
}).finally(() => prisma.$disconnect());
