import prisma from "@/lib/prisma";

export type VendorPortalBindingInput = {
  clerkUserId: string;
  organizationId: number;
  vendorId: number;
};

export async function bindVendorPortalUser(
  input: VendorPortalBindingInput,
) {
  const clerkUserId =
    String(
      input.clerkUserId ?? "",
    ).trim();

  const organizationId =
    Number(
      input.organizationId,
    );

  const vendorId =
    Number(
      input.vendorId,
    );

  if (!clerkUserId) {
    throw new Error(
      "A Clerk user id is required.",
    );
  }

  if (
    !Number.isInteger(
      organizationId,
    ) ||
    organizationId <= 0
  ) {
    throw new Error(
      "A valid organization id is required.",
    );
  }

  if (
    !Number.isInteger(
      vendorId,
    ) ||
    vendorId <= 0
  ) {
    throw new Error(
      "A valid vendor id is required.",
    );
  }

  const existing =
    await prisma.vendorPortalUser.findUnique({
      where: {
        clerkUserId,
      },
    });

  if (existing) {

    if (
      existing.organizationId !==
        organizationId ||
      existing.vendorId !==
        vendorId
    ) {
      throw new Error(
        "This Clerk user is already bound to another vendor identity.",
      );
    }

    return existing;
  }

  const vendor =
    await prisma.vendor.findFirst({
      where: {
        id:
          vendorId,

        organizationId,
      },

      select: {
        id:
          true,

        organizationId:
          true,
      },
    });

  if (!vendor) {
    throw new Error(
      "Vendor does not belong to the requested organization.",
    );
  }

  return prisma.vendorPortalUser.create({
    data: {
      clerkUserId,

      organization: {
        connect: {
          id:
            organizationId,
        },
      },

      vendor: {
        connect: {
          id:
            vendorId,
        },
      },
    },
  });
}