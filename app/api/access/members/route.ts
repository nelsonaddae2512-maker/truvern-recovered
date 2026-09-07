import { NextRequest, NextResponse } from "next/server";

import {
  getGovernanceActor,
  hasGovernanceCapability,
} from "@/lib/auth/truvern-governance";
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
  const actor = await getGovernanceActor();

  if (
    !["OWNER", "ADMIN", "ANALYST", "VIEWER"].includes(
      actor.role,
    ) ||
    !actor.organizationId
  ) {
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
        actor.organizationId!,
      );

    return json(200, {
      ok: true,
      role: actor.role,
      canManageMembers:
        hasGovernanceCapability(
          actor,
          "member.manage",
        ),
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
      !hasGovernanceCapability(
        actor,
        "member.manage",
      )
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
          actor.organizationId!,
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

    return json(500, {
      ok: false,
      error:
        error?.message ||
        "Unable to provision organization access.",
    });
  }
}
