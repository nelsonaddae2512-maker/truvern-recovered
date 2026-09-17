import { NextResponse } from "next/server";

import {
  canManageCustomerMembers,
  getCustomerOrganizationActor,
} from "@/lib/auth/customer-organization-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const actor = await getCustomerOrganizationActor();

  return NextResponse.json(
    actor
      ? {
          hasCustomerAccess: true,
          role: actor.role,
          canManageMembers: canManageCustomerMembers(actor),
        }
      : {
          hasCustomerAccess: false,
          role: null,
          canManageMembers: false,
        },
    {
      headers: {
        "cache-control": "no-store",
      },
    },
  );
}
