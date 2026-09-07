"use client";

import { FormEvent, useEffect, useState } from "react";

type Member = {
  membershipId: number;
  userId: number;
  email: string;
  name: string | null;
  role: string;
  createdAt: string;
};

type AccessResponse = {
  ok?: boolean;
  role?: string;
  canManageMembers?: boolean;
  members?: Member[];
  error?: string;
};

const roleCopy: Record<string, string> = {
  OWNER: "Full governance, member, release, and billing authority.",
  ADMIN: "Governance and member administration authority.",
  ANALYST: "Assessment review and finding-management access.",
  VIEWER: "Read-only governance access.",
};

export default function AccessMembers() {
  const [members, setMembers] =
    useState<Member[]>([]);

  const [role, setRole] =
    useState("");

  const [canManageMembers, setCanManageMembers] =
    useState(false);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  const [message, setMessage] =
    useState("");

  const [email, setEmail] =
    useState("");

  const [name, setName] =
    useState("");

  const [newRole, setNewRole] =
    useState("ANALYST");

  async function loadMembers() {
    setLoading(true);
    setError("");

    try {
      const response =
        await fetch(
          "/api/access/members",
          {
            cache: "no-store",
          },
        );

      const body =
        (await response.json()) as AccessResponse;

      if (!response.ok || !body.ok) {
        throw new Error(
          body.error ||
            "Unable to load organization access.",
        );
      }

      setMembers(body.members ?? []);
      setRole(body.role ?? "");
      setCanManageMembers(
        Boolean(body.canManageMembers),
      );
    } catch (caught: any) {
      setError(
        caught?.message ||
          "Unable to load organization access.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadMembers();
  }, []);

  async function submit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (saving) return;

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response =
        await fetch(
          "/api/access/members",
          {
            method: "POST",
            headers: {
              "content-type":
                "application/json",
            },
            body: JSON.stringify({
              email,
              name,
              role: newRole,
            }),
          },
        );

      const body =
        (await response.json()) as AccessResponse;

      if (!response.ok || !body.ok) {
        throw new Error(
          body.error ||
            "Unable to provision access.",
        );
      }

      setEmail("");
      setName("");
      setNewRole("ANALYST");

      setMessage(
        "Organization access provisioned.",
      );

      await loadMembers();
    } catch (caught: any) {
      setError(
        caught?.message ||
          "Unable to provision access.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">
              Organization access
            </p>

            <h2 className="mt-2 text-xl font-semibold text-white">
              Members and governance roles
            </h2>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
              Access is scoped to your current Truvern organization.
              Roles determine governance capabilities independently
              from subscription-plan entitlements.
            </p>
          </div>

          {role ? (
            <div className="rounded-2xl border border-cyan-400/20 bg-cyan-500/10 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.16em] text-cyan-300">
                Your role
              </p>
              <p className="mt-1 font-semibold text-white">
                {role}
              </p>
            </div>
          ) : null}
        </div>
      </section>

      {error ? (
        <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 p-4 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      {message ? (
        <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4 text-sm text-emerald-100">
          {message}
        </div>
      ) : null}

      {canManageMembers ? (
        <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-white">
            Add organization member
          </h2>

          <p className="mt-2 text-sm leading-6 text-slate-400">
            Provision ADMIN, ANALYST, or VIEWER access.
            Owner access cannot be created here.
          </p>

          <form
            onSubmit={submit}
            className="mt-5 grid gap-4 lg:grid-cols-[1.1fr_1.4fr_0.8fr_auto]"
          >
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">
                Name
              </span>
              <input
                value={name}
                onChange={(event) =>
                  setName(event.target.value)
                }
                placeholder="Team member"
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none ring-0 placeholder:text-slate-600 focus:border-cyan-400/40"
              />
            </label>

            <label className="block">
              <span className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">
                Email
              </span>
              <input
                type="email"
                required
                value={email}
                onChange={(event) =>
                  setEmail(event.target.value)
                }
                placeholder="member@company.com"
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none ring-0 placeholder:text-slate-600 focus:border-cyan-400/40"
              />
            </label>

            <label className="block">
              <span className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">
                Role
              </span>
              <select
                value={newRole}
                onChange={(event) =>
                  setNewRole(event.target.value)
                }
                className="mt-2 w-full rounded-xl border border-white/10 bg-[#07111f] px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-400/40"
              >
                <option value="ADMIN">
                  Admin
                </option>
                <option value="ANALYST">
                  Analyst
                </option>
                <option value="VIEWER">
                  Viewer
                </option>
              </select>
            </label>

            <button
              type="submit"
              disabled={saving}
              className="self-end rounded-xl bg-cyan-400 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving
                ? "Adding..."
                : "Add member"}
            </button>
          </form>
        </section>
      ) : null}

      <section className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03]">
        <div className="border-b border-white/10 px-5 py-4 sm:px-6">
          <h2 className="font-semibold text-white">
            Current members
          </h2>
        </div>

        {loading ? (
          <p className="p-6 text-sm text-slate-400">
            Loading organization access...
          </p>
        ) : members.length === 0 ? (
          <p className="p-6 text-sm text-slate-400">
            No organization members were found.
          </p>
        ) : (
          <div className="divide-y divide-white/10">
            {members.map((member) => (
              <div
                key={member.membershipId}
                className="grid gap-3 px-5 py-4 sm:px-6 lg:grid-cols-[1.2fr_1.4fr_0.7fr_1.8fr]"
              >
                <div>
                  <p className="font-medium text-white">
                    {member.name ||
                      member.email}
                  </p>
                </div>

                <p className="text-sm text-slate-300">
                  {member.email}
                </p>

                <div>
                  <span className="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-2.5 py-1 text-xs font-semibold text-cyan-200">
                    {member.role}
                  </span>
                </div>

                <p className="text-sm leading-6 text-slate-400">
                  {roleCopy[member.role] ||
                    "Organization governance access."}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
