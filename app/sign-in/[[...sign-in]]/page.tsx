import { SignIn } from "@clerk/nextjs";

export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<{
    redirect_url?: string;
    redirectUrl?: string;
    redirect_url_complete?: string;
  }>;
}) {
  const params = (await searchParams) ?? {};

  const redirectUrl =
    params.redirect_url ||
    params.redirectUrl ||
    params.redirect_url_complete ||
    "/dashboard";

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 py-12">
      <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-slate-950/40">
        <SignIn
          routing="hash"
          signUpUrl="/sign-up"
          fallbackRedirectUrl={redirectUrl}
          forceRedirectUrl={redirectUrl}
        />
      </div>
    </main>
  );
}



