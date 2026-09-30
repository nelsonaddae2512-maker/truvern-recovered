import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  currentUser: vi.fn(),
  getCurrentTruvernAccess: vi.fn(),
  getCustomerOrganizationActor: vi.fn(),
  vendorPortalFindUnique: vi.fn(),
  readGovernanceDbUserId: vi.fn(),
  claimGovernanceDbUserByEmail: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({
  auth: mocks.auth,
  currentUser: mocks.currentUser,
}));

vi.mock("@/lib/truvern-ops-access", () => ({
  getCurrentTruvernAccess:
    mocks.getCurrentTruvernAccess,
}));

vi.mock(
  "@/lib/auth/customer-organization-access",
  () => ({
    getCustomerOrganizationActor:
      mocks.getCustomerOrganizationActor,
  }),
);

vi.mock(
  "@/lib/repositories/governance-auth-repository",
  () => ({
    readGovernanceDbUserId:
      mocks.readGovernanceDbUserId,
    claimGovernanceDbUserByEmail:
      mocks.claimGovernanceDbUserByEmail,
  }),
);

vi.mock("@/lib/prisma", () => ({
  default: {
    vendorPortalUser: {
      findUnique:
        mocks.vendorPortalFindUnique,
    },
  },
}));

import {
  getGovernanceActor,
} from "@/lib/auth/truvern-governance";

describe("getGovernanceActor", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    delete process.env.TRUVERN_OPS_USERS;

    mocks.auth.mockResolvedValue({
      userId: "clerk-customer",
    });

    mocks.currentUser.mockResolvedValue(null);

    mocks.getCurrentTruvernAccess.mockResolvedValue({
      isTruvernOperator: false,
      isTruvernReviewer: false,
    });

    mocks.vendorPortalFindUnique.mockResolvedValue(
      null,
    );

    mocks.getCustomerOrganizationActor.mockResolvedValue(
      null,
    );

    mocks.readGovernanceDbUserId.mockResolvedValue([]);
    mocks.claimGovernanceDbUserByEmail.mockResolvedValue(
      null,
    );
  });

  it("uses canonical customer organization resolution for a customer actor", async () => {
    mocks.getCustomerOrganizationActor.mockResolvedValue({
      organizationId: 24,
      role: "OWNER",
    });

    const actor =
      await getGovernanceActor();

    expect(actor).toEqual({
      userId: "clerk-customer",
      organizationId: 24,
      vendorId: null,
      role: "OWNER",
    });

    expect(
      mocks.getCustomerOrganizationActor,
    ).toHaveBeenCalledTimes(1);
  });

  it("preserves Ops precedence over customer organization resolution", async () => {
    mocks.getCurrentTruvernAccess.mockResolvedValue({
      isTruvernOperator: true,
      isTruvernReviewer: false,
    });

    mocks.getCustomerOrganizationActor.mockResolvedValue({
      organizationId: 24,
      role: "OWNER",
    });

    const actor =
      await getGovernanceActor();

    expect(actor).toEqual({
      userId: "clerk-customer",
      organizationId: null,
      vendorId: null,
      role: "OPS",
    });

    expect(
      mocks.getCustomerOrganizationActor,
    ).not.toHaveBeenCalled();

    expect(
      mocks.vendorPortalFindUnique,
    ).not.toHaveBeenCalled();
  });

  it("preserves vendor precedence over customer organization resolution", async () => {
    mocks.vendorPortalFindUnique.mockResolvedValue({
      organizationId: 31,
      vendorId: 44,
    });

    mocks.getCustomerOrganizationActor.mockResolvedValue({
      organizationId: 24,
      role: "OWNER",
    });

    const actor =
      await getGovernanceActor();

    expect(actor).toEqual({
      userId: "clerk-customer",
      organizationId: 31,
      vendorId: 44,
      role: "VENDOR",
    });

    expect(
      mocks.getCustomerOrganizationActor,
    ).not.toHaveBeenCalled();
  });

  it("preserves Truvern reviewer fallback when no customer organization resolves", async () => {
    mocks.getCurrentTruvernAccess.mockResolvedValue({
      isTruvernOperator: false,
      isTruvernReviewer: true,
    });

    const actor =
      await getGovernanceActor();

    expect(actor).toEqual({
      userId: "clerk-customer",
      organizationId: null,
      vendorId: null,
      role: "TRUVERN_REVIEWER",
    });

    expect(
      mocks.getCustomerOrganizationActor,
    ).toHaveBeenCalledTimes(1);
  });
});