import { redirect } from "next/navigation";

import AccessMembers from "@/components/access/access-members.client";
import { getGovernanceActor } from "@/lib/auth/truvern-governance";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AccessPage() {
  const actor =
    await getGovernanceActor();

  if (
    !["OWNER", "ADMIN", "ANALYST", "VIEWER"].includes(
      actor.role,
    ) ||
    !actor.organizationId
  ) {
    redirect("/dashboard");
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="mb-7">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
          Governance administration
        </p>

        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          Access
        </h1>

        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400 sm:text-base">
          Review who can access your organization and how
          governance responsibilities are divided across the team.
        </p>
      </section>

      <AccessMembers />
    </main>
  );
}
