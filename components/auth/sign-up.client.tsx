"use client";

import { SignUp } from "@clerk/nextjs";

export default function SignUpClient({ redirectUrl }: { redirectUrl: string }) {
  return <SignUp redirectUrl={redirectUrl} afterSignUpUrl={redirectUrl} />;
}

