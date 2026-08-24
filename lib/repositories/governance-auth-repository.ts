import prisma from "@/lib/prisma";

export type GovernanceAuthUserRow = {
  id: number;
};

export async function readGovernanceDbUserId(
  clerkUserId: string,
): Promise<GovernanceAuthUserRow[]> {
  const user = await prisma.user.findUnique({
    where: {
      clerkId: clerkUserId,
    },
    select: {
      id: true,
    },
  });

  if (user) {
    return [user];
  }

  const numericUserId = Number(clerkUserId);

  if (
    Number.isSafeInteger(numericUserId) &&
    numericUserId > 0 &&
    String(numericUserId) === clerkUserId
  ) {
    const numericUser = await prisma.user.findUnique({
      where: {
        id: numericUserId,
      },
      select: {
        id: true,
      },
    });

    if (numericUser) {
      return [numericUser];
    }
  }

  return [];
}
