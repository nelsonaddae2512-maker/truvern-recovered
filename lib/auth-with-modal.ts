// lib/auth-with-modal.ts
import "server-only";

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

function enc(s: string) {
  return encodeURIComponent(s);
}

/**
 * Server-side auth guard that redirects to a PUBLIC /auth route
 * which opens Clerk's SignIn modal, then returns to `returnTo`.
 */
export async function requireAuthWithModal(returnTo: string) {
  const { userId } = await auth();
  if (!userId) {
    redirect(`/auth?mode=signin&returnTo=${enc(returnTo)}`);
  }
  return { userId };
}





