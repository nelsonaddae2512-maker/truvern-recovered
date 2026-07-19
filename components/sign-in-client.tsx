// components/sign-in-client.tsx
"use client";

import { useEffect, useState } from "react";
import { SignIn } from "@clerk/nextjs";

export default function SignInClient({
  redirectUrl,
}: {
  redirectUrl: string;
}) {
  // Prevent SSR/CSR markup mismatch (Clerk mounts client-side)
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-10">
      <SignIn redirectUrl={redirectUrl} />
    </div>
  );
}

