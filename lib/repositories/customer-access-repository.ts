import type { OrgRole } from "@prisma/client";

import prisma from "@/lib/prisma";
import {
  findFirstOrgMembership,
  upsertOrgMembership,
} from "@/lib/repositories/org-membership-repository";
import { upsertUser } from "@/lib/repositories/user-repository";

export const CUSTOMER_ACCESS_ROLES = [
  "ADMIN",
  "ANALYST",
  "VIEWER",
] as const;

export type CustomerManagedRole =
  (typeof CUSTOMER_ACCESS_ROLES)[number];

export type CustomerAccessMember = {
  membershipId: number;
  userId: number;
  email: string;
  name: string | null;
  role: OrgRole;
  createdAt: Date;
};

export function isCustomerManagedRole(
  value: string,
): value is CustomerManagedRole {
  return CUSTOMER_ACCESS_ROLES.includes(
    value as CustomerManagedRole,
  );
}

export async function readCustomerAccessMembers(
  organizationId: number,
): Promise<CustomerAccessMember[]> {
  const memberships =
    await prisma.orgMembership.findMany({
      where: {
        organizationId,
        role: {
          in: [
            "OWNER",
            "ADMIN",
            "ANALYST",
            "VIEWER",
          ],
        },
      },
      select: {
        id: true,
        role: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
      orderBy: [
        { role: "asc" },
        { createdAt: "asc" },
        { id: "asc" },
      ],
    });

  return memberships.map((membership) => ({
    membershipId: membership.id,
    userId: membership.user.id,
    email: membership.user.email,
    name: membership.user.name,
    role: membership.role,
    createdAt: membership.createdAt,
  }));
}

export async function provisionCustomerAccessMember(input: {
  organizationId: number;
  email: string;
  name: string;
  role: CustomerManagedRole;
}): Promise<CustomerAccessMember> {
  const email =
    input.email.trim().toLowerCase();

  const existingMembership =
    await findFirstOrgMembership({
      where: {
        organizationId: input.organizationId,
        user: {
          email: {
            equals: email,
            mode: "insensitive",
          },
        },
      },
      select: {
        id: true,
        role: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });

  if (existingMembership) {
    return {
      membershipId: existingMembership.id,
      userId: existingMembership.user.id,
      email: existingMembership.user.email,
      name: existingMembership.user.name,
      role: existingMembership.role,
      createdAt: existingMembership.createdAt,
    };
  }

  const user =
    await upsertUser({
      where: {
        email,
      },
      create: {
        email,
        name: input.name || email.split("@")[0],
      },
      update: input.name
        ? {
            name: input.name,
          }
        : {},
      select: {
        id: true,
        email: true,
        name: true,
      },
    });

  const membership =
    await upsertOrgMembership({
      where: {
        userId_organizationId: {
          userId: user.id,
          organizationId: input.organizationId,
        },
      },
      create: {
        userId: user.id,
        organizationId: input.organizationId,
        role: input.role,
      },
      update: {},
      select: {
        id: true,
        role: true,
        createdAt: true,
      },
    });

  return {
    membershipId: membership.id,
    userId: user.id,
    email: user.email,
    name: user.name,
    role: membership.role,
    createdAt: membership.createdAt,
  };
}
