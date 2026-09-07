import { NextRequest, NextResponse } from "next/server";

import {
  canManageCustomerMembers,
  getCustomerOrganizationActor,
} from "@/lib/auth/customer-organization-access";
import {
  isCustomerManagedRole,
  provisionCustomerAccessMember,
  readCustomerAccessMembers,
} from "@/lib/repositories/customer-access-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function json(
  status: number,
  body: Record<string, unknown>,
) {
  return NextResponse.json(body, {
    status,
    headers: {
      "cache-control": "no-store",
    },
  });
}

function safeString(value: unknown) {
  return typeof value === "string"
    ? value.trim()
    : "";
}

async function requireCustomerAccessActor() {
  const actor =
    await getCustomerOrganizationActor();

  if (!actor) {
    throw new Error(
      "Customer organization access required.",
    );
  }

  return actor;
}

export async function GET() {
  try {
    const actor =
      await requireCustomerAccessActor();

    const members =
      await readCustomerAccessMembers(
        actor.organizationId,
      );

    return json(200, {
      ok: true,
      role: actor.role,
      canManageMembers:
        canManageCustomerMembers(actor),
      members,
    });
  } catch (error: any) {
    console.error(
      "CUSTOMER_ACCESS_LIST_ERROR",
      error,
    );

    return json(403, {
      ok: false,
      error:
        error?.message ||
        "Unable to read organization access.",
    });
  }
}

export async function POST(
  request: NextRequest,
) {
  try {
    const actor =
      await requireCustomerAccessActor();

    if (
      !canManageCustomerMembers(actor)
    ) {
      return json(403, {
        ok: false,
        error:
          "Member management permission required.",
      });
    }

    const body =
      await request.json().catch(() => ({}));

    const email =
      safeString(body?.email).toLowerCase();

    const name =
      safeString(body?.name);

    const role =
      safeString(body?.role).toUpperCase();

    if (
      !email ||
      !email.includes("@")
    ) {
      return json(400, {
        ok: false,
        error: "Valid email required.",
      });
    }

    if (!isCustomerManagedRole(role)) {
      return json(400, {
        ok: false,
        error:
          "Role must be ADMIN, ANALYST, or VIEWER.",
      });
    }

    const member =
      await provisionCustomerAccessMember({
        organizationId:
          actor.organizationId,
        email,
        name,
        role,
      });

    return json(200, {
      ok: true,
      member,
    });
  } catch (error: any) {
    console.error(
      "CUSTOMER_ACCESS_CREATE_ERROR",
      error,
    );

    return json(403, {
      ok: false,
      error:
        error?.message ||
        "Customer organization access required.",
    });
  }
}
