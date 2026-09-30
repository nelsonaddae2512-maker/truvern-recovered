import { NextResponse } from "next/server";

import { bootstrapCurrentOrganizationFromRuntime } from "@/lib/auth/organization-bootstrap-runtime";

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

function failureStatus(reason: string) {
  switch (reason) {
    case "UNAUTHENTICATED":
      return 401;

    case "USER_NOT_PROVISIONED":
    case "USER_IDENTITY_CONFLICT":
    case "ORGANIZATION_BOOTSTRAP_FAILED":
    case "ORGANIZATION_IDENTITY_CONFLICT":
    case "BOOTSTRAP_IDENTITY_INVARIANT_VIOLATION":
    case "VERIFICATION_INVARIANT_VIOLATION":
      return 409;

    case "NO_SELECTED_ORGANIZATION":
    case "ORGANIZATION_CONTEXT_MISMATCH":
    case "ORGANIZATION_MISMATCH":
    case "MEMBERSHIP_REQUIRED":
    case "MEMBERSHIP_USER_MISMATCH":
    case "MEMBERSHIP_ORGANIZATION_MISMATCH":
    case "ROLE_MAPPING_REQUIRED":
    case "AUTHENTICATED_IDENTITY_MISMATCH":
    case "AUTHENTICATED_EMAIL_REQUIRED":
    case "ORGANIZATION_IDENTITY_REQUIRED":
    case "INVALID_INPUT":
      return 403;

    default:
      return 403;
  }
}

export async function POST() {
  try {
    const result =
      await bootstrapCurrentOrganizationFromRuntime();

    if (!result.ok) {
      return json(
        failureStatus(result.reason),
        {
          ok: false,
          reason: result.reason,
        },
      );
    }

    return json(200, {
      ok: true,
      userId: result.userId,
      organizationId: result.organizationId,
      role: result.role,
      userClaimed: result.userClaimed,
      organizationCreated:
        result.organizationCreated,
      membershipCreated:
        result.membershipCreated,
      primaryOrganizationUpdated:
        result.primaryOrganizationUpdated,
    });
  } catch (error: unknown) {
    console.error(
      "ORGANIZATION_BOOTSTRAP_API_ERROR",
      error,
    );

    return json(500, {
      ok: false,
      reason: "INTERNAL_ERROR",
    });
  }
}