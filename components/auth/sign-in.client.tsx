"use client";

import { SignIn } from "@clerk/nextjs";

export default function SignInClient({ redirectUrl }: { redirectUrl: string }) {
  return <SignIn redirectUrl={redirectUrl} afterSignInUrl={redirectUrl} />;
}

