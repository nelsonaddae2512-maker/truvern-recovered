import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";

type Props = {
  searchParams?: Promise<{
    assessmentId?: string;
    vendorId?: string;
  }>;
};

function safeInt(value: unknown) {
  const n = Number(String(value ?? "").trim());
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

export default async function StartReviewPage({ searchParams }: Props) {
  const resolved = (await searchParams) ?? {};

  const assessmentId = safeInt(resolved.assessmentId);
  const vendorId = safeInt(resolved.vendorId);

  if (!assessmentId || !vendorId) {
    redirect("/review-desk");
  }

  const rows: Array<{
    assignmentId: number;
  }> = await prisma.$queryRawUnsafe(
    `
    with vendor_row as (
      select id, name, "organizationId"
      from "Vendor"
      where id = $1
      limit 1
    ),
    existing as (
      select ra.id as "assignmentId"
      from "ReviewAssignment" ra
      join "ReviewRequest" rr on rr.id = ra."reviewRequestId"
      join vendor_row v on v.id = rr."vendorId"
      where rr."assessmentId" = $2
        and rr."vendorId" = $1
        and ra."assignmentType"::text = 'INTERNAL'
        and ra.status::text in ('PENDING', 'IN_PROGRESS', 'SUBMITTED')
      order by ra."updatedAt" desc, ra.id desc
      limit 1
    ),
    inserted_request as (
      insert into "ReviewRequest" (
        "organizationId",
        "vendorId",
        "assessmentId",
        title,
        note,
        status,
        "updatedAt"
      )
      select
        v."organizationId",
        v.id,
        $2,
        'Internal review · ' || v.name,
        'Started from Governance Ops intake.',
        'REQUESTED'::text,
        now()
      from vendor_row v
      where not exists (select 1 from existing)
      returning id, "organizationId", "vendorId"
    ),
    inserted_assignment as (
      insert into "ReviewAssignment" (
        "organizationId",
        "vendorId",
        "reviewRequestId",
        "assignmentType",
        status,
        note,
        "updatedAt"
      )
      select
        ir."organizationId",
        ir."vendorId",
        ir.id,
        'INTERNAL',
        'PENDING'::text,
        'Internal review started.',
        now()
      from inserted_request ir
      returning id as "assignmentId"
    )
    select "assignmentId" from existing
    union all
    select "assignmentId" from inserted_assignment
    limit 1
    `,
    vendorId,
    assessmentId,
  );

  const assignmentId = rows[0]?.assignmentId;

  if (!assignmentId) {
    redirect("/review-desk");
  }

  redirect(`/review-desk/reviews/${assignmentId}`);
}



