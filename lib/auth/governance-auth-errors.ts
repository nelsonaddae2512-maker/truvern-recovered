import { NextResponse } from "next/server";

export class GovernanceAuthError extends Error {
  status: number;

  constructor(message: string, status = 403) {
    super(message);
    this.name = "GovernanceAuthError";
    this.status = status;
  }
}

export function governanceUnauthorized(message = "Authentication required.") {
  return new GovernanceAuthError(message, 401);
}

export function governanceForbidden(message = "Access denied.") {
  return new GovernanceAuthError(message, 403);
}

export function governanceAuthErrorResponse(error: unknown) {
  if (error instanceof GovernanceAuthError) {
    return NextResponse.json(
      {
        ok: false,
        error: error.message,
      },
      { status: error.status },
    );
  }

  return null;
}

