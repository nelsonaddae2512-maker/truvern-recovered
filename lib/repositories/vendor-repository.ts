import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";

type VendorClient = Pick<
  Prisma.TransactionClient,
  "vendor"
>;

export async function findVendor<
  T extends Prisma.VendorFindUniqueArgs,
>(
  args: Prisma.SelectSubset<
    T,
    Prisma.VendorFindUniqueArgs
  >,
  client: VendorClient = prisma,
): Promise<
  Prisma.VendorGetPayload<T> | null
> {
  return client.vendor.findUnique(args);
}
export async function findVendors<
  T extends Prisma.VendorFindManyArgs,
>(
  args: Prisma.SelectSubset<
    T,
    Prisma.VendorFindManyArgs
  >,
  client: VendorClient = prisma,
): Promise<
  Prisma.VendorGetPayload<T>[]
> {
  return client.vendor.findMany(args);
}

export async function findFirstVendor<
  T extends Prisma.VendorFindFirstArgs,
>(
  args: Prisma.SelectSubset<T, Prisma.VendorFindFirstArgs>,
  client: VendorClient = prisma,
): Promise<Prisma.VendorGetPayload<T> | null> {
  return client.vendor.findFirst(args);
}

export async function updateVendor<
  T extends Prisma.VendorUpdateArgs,
>(
  args: Prisma.SelectSubset<T, Prisma.VendorUpdateArgs>,
  client: VendorClient = prisma,
): Promise<Prisma.VendorGetPayload<T>> {
  return client.vendor.update(args);
}

export async function createVendor<
  T extends Prisma.VendorCreateArgs,
>(
  args: Prisma.SelectSubset<T, Prisma.VendorCreateArgs>,
  client: VendorClient = prisma,
): Promise<Prisma.VendorGetPayload<T>> {
  return client.vendor.create(args);
}
