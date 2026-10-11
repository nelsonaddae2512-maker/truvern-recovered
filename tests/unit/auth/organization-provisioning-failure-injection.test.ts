import { describe, expect, it, vi } from "vitest";

import {
  persistVerifiedOrganizationProvisioning,
} from "@/lib/auth/organization-provisioning-persistence";

const input = {
  clerkUserId: "clerk_user_77",
  clerkOrganizationId: "clerk_org_13",
  authorizedRole: "OWNER" as const,
};

function createTransaction(options: {
  existingRole?: "OWNER" | "ADMIN" | "ANALYST" | "VIEWER";
  primaryOrganizationId?: number | null;
} = {}) {
  const user = {
    id: 77,
    organizationId: options.primaryOrganizationId ?? null,
  };

  return {
    user: {
      findUnique: vi.fn(async () => user),
      update: vi.fn(async () => ({ id: user.id })),
    },
    organization: {
      findUnique: vi.fn(async () => ({ id: 13 })),
    },
    orgMembership: {
      findUnique: vi.fn(async () =>
        options.existingRole
          ? { role: options.existingRole }
          : null,
      ),
      create: vi.fn(async () => ({
        role: input.authorizedRole,
      })),
      update: vi.fn(),
      upsert: vi.fn(),
    },
  };
}

function dependencies(tx: ReturnType<typeof createTransaction>) {
  return {
    runTransaction: vi.fn(async (
      callback: (transaction: typeof tx) => Promise<unknown>,
    ) => callback(tx)),
  };
}

describe("organization provisioning failure injection", () => {
  it("does not update the primary organization if membership creation fails", async () => {
    const tx = createTransaction();
    const failure = new Error("membership insert failed");

    tx.orgMembership.create.mockRejectedValueOnce(failure);

    const deps = dependencies(tx);

    await expect(
      persistVerifiedOrganizationProvisioning(
        input,
        deps as never,
      ),
    ).rejects.toBe(failure);

    expect(deps.runTransaction).toHaveBeenCalledTimes(1);
    expect(tx.orgMembership.create).toHaveBeenCalledTimes(1);
    expect(tx.user.update).not.toHaveBeenCalled();
    expect(tx.orgMembership.update).not.toHaveBeenCalled();
    expect(tx.orgMembership.upsert).not.toHaveBeenCalled();
  });

  it("propagates a primary-organization update failure through the transaction boundary", async () => {
    const tx = createTransaction();
    const failure = new Error("primary organization update failed");

    tx.user.update.mockRejectedValueOnce(failure);

    const deps = dependencies(tx);

    await expect(
      persistVerifiedOrganizationProvisioning(
        input,
        deps as never,
      ),
    ).rejects.toBe(failure);

    expect(tx.orgMembership.create).toHaveBeenCalledTimes(1);
    expect(tx.user.update).toHaveBeenCalledTimes(1);
    expect(tx.orgMembership.update).not.toHaveBeenCalled();
    expect(tx.orgMembership.upsert).not.toHaveBeenCalled();
  });

  it("does not silently elevate an existing membership during retry", async () => {
    const tx = createTransaction({
      existingRole: "VIEWER",
      primaryOrganizationId: 13,
    });

    const result = await persistVerifiedOrganizationProvisioning(
      input,
      dependencies(tx) as never,
    );

    expect(result).toMatchObject({
      ok: true,
      role: "VIEWER",
      membershipCreated: false,
      primaryOrganizationUpdated: false,
    });

    expect(tx.orgMembership.create).not.toHaveBeenCalled();
    expect(tx.orgMembership.update).not.toHaveBeenCalled();
    expect(tx.orgMembership.upsert).not.toHaveBeenCalled();
    expect(tx.user.update).not.toHaveBeenCalled();
  });

  it("propagates a simulated duplicate membership conflict without overwriting roles", async () => {
    const tx = createTransaction();

    const conflict = Object.assign(
      new Error("unique constraint violation"),
      { code: "P2002" },
    );

    tx.orgMembership.create.mockRejectedValueOnce(conflict);

    await expect(
      persistVerifiedOrganizationProvisioning(
        input,
        dependencies(tx) as never,
      ),
    ).rejects.toBe(conflict);

    expect(tx.orgMembership.update).not.toHaveBeenCalled();
    expect(tx.orgMembership.upsert).not.toHaveBeenCalled();
    expect(tx.user.update).not.toHaveBeenCalled();
  });

  it("allows a later retry to reuse an existing membership without another insert", async () => {
    const firstTx = createTransaction();
    const failure = new Error("temporary insert failure");

    firstTx.orgMembership.create.mockRejectedValueOnce(failure);

    await expect(
      persistVerifiedOrganizationProvisioning(
        input,
        dependencies(firstTx) as never,
      ),
    ).rejects.toBe(failure);

    const retryTx = createTransaction({
      existingRole: "ANALYST",
      primaryOrganizationId: 13,
    });

    const retry = await persistVerifiedOrganizationProvisioning(
      input,
      dependencies(retryTx) as never,
    );

    expect(retry).toMatchObject({
      ok: true,
      role: "ANALYST",
      membershipCreated: false,
      primaryOrganizationUpdated: false,
    });

    expect(retryTx.orgMembership.create).not.toHaveBeenCalled();
    expect(retryTx.orgMembership.update).not.toHaveBeenCalled();
    expect(retryTx.user.update).not.toHaveBeenCalled();
  });

  it("uses exact Clerk identity and organization lookups before attempting writes", async () => {
    const tx = createTransaction();

    await persistVerifiedOrganizationProvisioning(
      input,
      dependencies(tx) as never,
    );

    expect(tx.user.findUnique).toHaveBeenCalledWith({
      where: {
        clerkId: "clerk_user_77",
      },
      select: {
        id: true,
        organizationId: true,
      },
    });

    expect(tx.organization.findUnique).toHaveBeenCalledWith({
      where: {
        clerkOrgId: "clerk_org_13",
      },
      select: {
        id: true,
      },
    });

    expect(tx.orgMembership.findUnique).toHaveBeenCalledWith({
      where: {
        userId_organizationId: {
          userId: 77,
          organizationId: 13,
        },
      },
      select: {
        role: true,
      },
    });
  });
});