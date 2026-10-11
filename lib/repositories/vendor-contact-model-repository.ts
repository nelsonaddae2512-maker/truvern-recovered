import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";

type VendorContactClient = Pick<
  Prisma.TransactionClient,
  "vendorContact"
>;

export async function findFirstVendorContact<
  T extends Prisma.VendorContactFindFirstArgs,
>(
  args: Prisma.SelectSubset<T, Prisma.VendorContactFindFirstArgs>,
  client: VendorContactClient = prisma,
): Promise<Prisma.VendorContactGetPayload<T> | null> {
  return client.vendorContact.findFirst(args);
}

export async function createVendorContact<
  T extends Prisma.VendorContactCreateArgs,
>(
  args: Prisma.SelectSubset<T, Prisma.VendorContactCreateArgs>,
  client: VendorContactClient = prisma,
): Promise<Prisma.VendorContactGetPayload<T>> {
  return client.vendorContact.create(args);
}

export async function updateManyVendorContacts(
  args: Prisma.VendorContactUpdateManyArgs,
  client: VendorContactClient = prisma,
) {
  return client.vendorContact.updateMany(args);
}

export async function updateVendorContact<
  T extends Prisma.VendorContactUpdateArgs,
>(
  args: Prisma.SelectSubset<T, Prisma.VendorContactUpdateArgs>,
  client: VendorContactClient = prisma,
): Promise<Prisma.VendorContactGetPayload<T>> {
  return client.vendorContact.update(args);
}

export async function deleteVendorContact<
  T extends Prisma.VendorContactDeleteArgs,
>(
  args: Prisma.SelectSubset<T, Prisma.VendorContactDeleteArgs>,
  client: VendorContactClient = prisma,
): Promise<Prisma.VendorContactGetPayload<T>> {
  return client.vendorContact.delete(args);
}