import { createHash } from "node:crypto";

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { requireOpsAccess } from "@/lib/auth/truvern-governance";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function sha256(value: string) {
  return createHash("sha256")
    .update(value, "utf8")
    .digest("hex");
}

export async function GET() {
  await requireOpsAccess();

  const session = await auth();
  const clerkUserId = session.userId;

  if (!clerkUserId) {
    return NextResponse.json(
      {
        authenticated: false,
        currentClerkIdFingerprint: null,
        matchingDbUserCount: null,
        matchingDbUserIds: [],
      },
      {
        status: 401,
        headers: {
          "cache-control": "no-store",
        },
      },
    );
  }

  const matchingUsers = await prisma.user.findMany({
    where: {
      clerkId: clerkUserId,
    },
    select: {
      id: true,
    },
    orderBy: {
      id: "asc",
    },
  });

  return NextResponse.json(
    {
      authenticated: true,
      currentClerkIdFingerprint: sha256(clerkUserId),
      matchingDbUserCount: matchingUsers.length,
      matchingDbUserIds: matchingUsers.map((user) => user.id),
    },
    {
      headers: {
        "cache-control": "no-store",
      },
    },
  );
}