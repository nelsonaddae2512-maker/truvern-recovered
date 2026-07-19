import { auth, clerkClient } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

type TruvernAccess = {
  userId: string | null;
  email: string | null;
  isTruvernOperator: boolean;
  isTruvernReviewer: boolean;
  canManageTruvernReview: boolean;
};

function list(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.flatMap(list);
  if (typeof value === "string") {
    return value
      .split(/[,\s]+/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function collectRoles(...sources: any[]): string[] {
  const values: string[] = [];

  for (const source of sources) {
    if (!source || typeof source !== "object") continue;

    values.push(
      ...list(source.role),
      ...list(source.roles),
      ...list(source.permission),
      ...list(source.permissions),
      ...list(source.truvernRole),
      ...list(source.truvernRoles),
      ...list(source.appRole),
      ...list(source.appRoles),
    );
  }

  return values.map((value) => value.toLowerCase());
}

function envEmails(name: string): string[] {
  return list(process.env[name]).map((email) => email.toLowerCase());
}

function hasAnyRole(roles: string[], allowed: string[]) {
  return roles.some((role) => allowed.includes(role));
}

export async function getCurrentTruvernAccess(): Promise<TruvernAccess> {
  const session = await auth();
  const userId = session.userId ?? null;

  if (!userId) {
    return {
      userId: null,
      email: null,
      isTruvernOperator: false,
      isTruvernReviewer: false,
      canManageTruvernReview: false,
    };
  }

  let email: string | null = null;
  let userMetadata: any = {};

  try {
    const client = await clerkClient();
    const user = await client.users.getUser(userId);

    email =
      user.emailAddresses.find((item) => item.id === user.primaryEmailAddressId)
        ?.emailAddress ??
      user.emailAddresses[0]?.emailAddress ??
      null;

    userMetadata = {
      publicMetadata: user.publicMetadata,
      privateMetadata: user.privateMetadata,
      unsafeMetadata: user.unsafeMetadata,
    };
  } catch {
    userMetadata = {};
  }

  const normalizedEmail = email?.toLowerCase() ?? null;

  const roles = collectRoles(
    session.sessionClaims,
    (session.sessionClaims as any)?.metadata,
    (session.sessionClaims as any)?.publicMetadata,
    (session.sessionClaims as any)?.privateMetadata,
    userMetadata.publicMetadata,
    userMetadata.privateMetadata,
    userMetadata.unsafeMetadata,
  );

  const opsEmails = [
    ...envEmails("TRUVERN_MASTER_EMAIL"),
    ...envEmails("TRUVERN_OPS_EMAILS"),
    ...envEmails("TRUVERN_ADMIN_EMAILS"),
    ...envEmails("ADMIN_EMAILS"),
    ...envEmails("TRUVERN_LOCAL_OPS_EMAILS"),
  ];

  const reviewerEmails = [
    ...opsEmails,
    ...envEmails("TRUVERN_REVIEWER_EMAILS"),
  ];

  const opsRoles = [
    "admin",
    "system_admin",
    "truvern_admin",
    "truvern_ops",
    "truvern_operator",
    "operator",
    "ops",
    "governance_ops",
  ];

  const reviewerRoles = [
    ...opsRoles,
    "reviewer",
    "truvern_reviewer",
    "governance_reviewer",
    "analyst",
  ];

  const isOpsByEmail =
    Boolean(normalizedEmail) && opsEmails.includes(normalizedEmail!);

  const isReviewerByEmail =
    Boolean(normalizedEmail) && reviewerEmails.includes(normalizedEmail!);

  const isTruvernOperator = isOpsByEmail || hasAnyRole(roles, opsRoles);
  const isTruvernReviewer =
    isTruvernOperator || isReviewerByEmail || hasAnyRole(roles, reviewerRoles);

  return {
    userId,
    email,
    isTruvernOperator,
    isTruvernReviewer,
    canManageTruvernReview: isTruvernOperator,
  };
}

export async function isTruvernOperator() {
  return (await getCurrentTruvernAccess()).isTruvernOperator;
}

export async function isTruvernReviewer() {
  return (await getCurrentTruvernAccess()).isTruvernReviewer;
}

export async function requireTruvernOperator() {
  const access = await getCurrentTruvernAccess();

  if (!access.isTruvernOperator) {
    redirect("/");
  }

  return access;
}

export async function requireTruvernReviewer() {
  const access = await getCurrentTruvernAccess();

  if (!access.isTruvernReviewer) {
    redirect("/");
  }

  return access;
}


