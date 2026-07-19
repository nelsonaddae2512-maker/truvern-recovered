"use client";

import { useEffect, useMemo, useState } from "react";

type RolesResponse = {
  ok?: boolean;
  roles?: unknown;
  error?: unknown;
};

type Props = {
  className?: string;
  defaultValue?: string;
  name?: string;
  required?: boolean;
};

function formatRoleLabel(value: string) {
  return value
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .replace(/\b[a-z]/g, (character) =>
      character.toUpperCase(),
    );
}

function normalizeRoles(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .map((role) => String(role ?? "").trim())
        .filter(Boolean),
    ),
  );
}

export default function VendorContactRoleSelect({
  className = "",
  defaultValue,
  name = "role",
  required = true,
}: Props) {
  const [roles, setRoles] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadRoles() {
      try {
        const response = await fetch(
          "/api/vendor-contact-roles",
          {
            method: "GET",
            cache: "no-store",
            headers: {
              accept: "application/json",
            },
          },
        );

        const payload =
          (await response.json().catch(() => ({}))) as
            RolesResponse;

        if (!response.ok || payload.ok === false) {
          throw new Error(
            String(
              payload.error ||
                "Unable to load contact roles.",
            ),
          );
        }

        const nextRoles = normalizeRoles(payload.roles);

        if (nextRoles.length === 0) {
          throw new Error(
            "No contact roles are configured.",
          );
        }

        if (active) {
          setRoles(nextRoles);
          setError("");
        }
      } catch (loadError) {
        if (active) {
          setRoles([]);
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load contact roles.",
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadRoles();

    return () => {
      active = false;
    };
  }, []);

  const selectedDefault = useMemo(() => {
    if (defaultValue && roles.includes(defaultValue)) {
      return defaultValue;
    }

    if (roles.includes("OTHER")) {
      return "OTHER";
    }

    return roles[0] || "";
  }, [defaultValue, roles]);

  const baseClassName = [
    className,
    "appearance-none",
    "pr-12",
    "cursor-pointer",
    "disabled:cursor-not-allowed",
    "disabled:opacity-60",
  ]
    .filter(Boolean)
    .join(" ");

  if (loading) {
    return (
      <div className="relative">
        <select
          name={name}
          required={required}
          disabled
          className={baseClassName}
          defaultValue=""
          aria-label="Vendor contact role"
        >
          <option value="">
            Loading contact roles...
          </option>
        </select>

        <span
          aria-hidden="true"
          className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-slate-400"
        >
          ▼
        </span>
      </div>
    );
  }

  if (error || roles.length === 0) {
    return (
      <div className="space-y-2">
        <div className="relative">
          <select
            name={name}
            required={required}
            disabled
            className={baseClassName}
            defaultValue=""
            aria-label="Vendor contact role"
          >
            <option value="">
              Contact roles unavailable
            </option>
          </select>

          <span
            aria-hidden="true"
            className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-slate-400"
          >
            ▼
          </span>
        </div>

        <p className="text-xs text-rose-300">
          {error || "Contact roles are unavailable."}
        </p>
      </div>
    );
  }

  return (
    <div className="relative">
      <select
        name={name}
        required={required}
        className={baseClassName}
        defaultValue={selectedDefault}
        aria-label="Vendor contact role"
      >
        {roles.map((role) => (
          <option key={role} value={role}>
            {formatRoleLabel(role)}
          </option>
        ))}
      </select>

      <span
        aria-hidden="true"
        className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-slate-400"
      >
        ▼
      </span>
    </div>
  );
}