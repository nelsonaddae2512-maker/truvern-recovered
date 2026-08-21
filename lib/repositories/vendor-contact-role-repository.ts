import prisma from "@/lib/prisma";

export type VendorContactRoleRow = {
  value: string;
};

export async function readVendorContactRoles(): Promise<
  VendorContactRoleRow[]
> {
  return prisma.$queryRaw<VendorContactRoleRow[]>`
    select
      e.enumlabel as value
    from pg_enum e
    join pg_type t
      on t.oid = e.enumtypid
    join pg_namespace n
      on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'VendorContactRole'
    order by e.enumsortorder
  `;
}