import crypto from "node:crypto";

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function fingerprint(
  value: string | null | undefined,
) {
  if (!value) {
    return null;
  }

  return crypto
    .createHash("sha256")
    .update(value)
    .digest("hex")
    .slice(0, 16);
}

export async function GET() {
  const {
    userId,
    orgId,
    orgRole,
  } = await auth();

  return NextResponse.json(
    {
      ok: true,

      serverAuth: {
        signedIn: Boolean(userId),

        userFingerprint:
          fingerprint(userId),

        organizationPresent:
          Boolean(orgId),

        organizationFingerprint:
          fingerprint(orgId),

        organizationRole:
          orgRole ?? null,
      },

      safety: {
        authOnly: true,
        databaseAccess: false,
        databaseWrites: false,
        clerkBackendApiRequest: false,
        clerkMutation: false,
        bootstrapInvocation: false,
        provisioningInvocation: false,
      },
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}