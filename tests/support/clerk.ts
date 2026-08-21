import { vi } from "vitest";

export type ClerkAuthState = {
  userId: string | null;
  orgId?: string | null;
};

const state: ClerkAuthState = {
  userId: "user_test_1",
  orgId: "org_test_1",
};

export const authMock = vi.fn(async () => ({
  userId: state.userId,
  orgId: state.orgId ?? null,
}));

export function setClerkAuth(next: ClerkAuthState): void {
  state.userId = next.userId;
  state.orgId = next.orgId ?? null;
}

export function resetClerkAuth(): void {
  state.userId = "user_test_1";
  state.orgId = "org_test_1";
  authMock.mockClear();
}
