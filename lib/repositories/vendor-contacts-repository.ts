import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";

export async function readAllowedVendorContactRoles(): Promise<
  Array<{ value: string }>
> {
  return prisma.$queryRaw<Array<{ value: string }>>`
    select e.enumlabel as value
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

export async function clearPrimaryVendorContacts(
  tx: Prisma.TransactionClient,
  vendorId: number,
): Promise<void> {
  await tx.$executeRaw`
    update "VendorContact"
    set
      "isPrimary" = false,
      "updatedAt" = current_timestamp
    where "vendorId" = ${vendorId}
  `;
}

export async function findVendorContactByEmail(
  tx: Prisma.TransactionClient,
  vendorId: number,
  email: string,
): Promise<Array<{ id: number }>> {
  return tx.$queryRaw<Array<{ id: number }>>`
    select id
    from "VendorContact"
    where "vendorId" = ${vendorId}
      and lower(email) = lower(${email})
    limit 1
  `;
}

export async function updateVendorContactRow(
  tx: Prisma.TransactionClient,
  input: {
    id: number;
    name: string;
    title: string | null;
    email: string;
    role: string;
    phone: string | null;
    isPrimary: boolean;
  },
): Promise<void> {
  await tx.$executeRaw`
    update "VendorContact"
    set
      name = ${input.name},
      title = ${input.title},
      email = ${input.email},
      role = ${input.role}::"VendorContactRole",
      phone = ${input.phone},
      "isPrimary" = ${input.isPrimary},
      "updatedAt" = current_timestamp
    where id = ${input.id}
  `;
}

export async function insertVendorContactRow(
  tx: Prisma.TransactionClient,
  input: {
    vendorId: number;
    name: string;
    title: string | null;
    email: string;
    role: string;
    phone: string | null;
    isPrimary: boolean;
  },
): Promise<void> {
  await tx.$executeRaw`
    insert into "VendorContact" (
      "vendorId",
      name,
      title,
      email,
      role,
      phone,
      "isPrimary",
      "createdAt",
      "updatedAt"
    )
    values (
      ${input.vendorId},
      ${input.name},
      ${input.title},
      ${input.email},
      ${input.role}::"VendorContactRole",
      ${input.phone},
      ${input.isPrimary},
      current_timestamp,
      current_timestamp
    )
  `;
}