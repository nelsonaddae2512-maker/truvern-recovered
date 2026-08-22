"use client";

import {
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";

type LicenseStatus =
  | "ACTIVE"
  | "SUSPENDED"
  | "REVOKED"
  | "EXPIRED"
  | "PENDING";

type Props = {
  licenseId: number;
  status: LicenseStatus;
  expiresAt: string | null;
};

type ActionName =
  | "suspend"
  | "reactivate"
  | "expiration";

function localDateValue(
  value: string | null,
) {
  if (!value) {
    return "";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return "";
  }

  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth() + 1,
    ).padStart(
      2,
      "0",
    );

  const day =
    String(
      date.getDate(),
    ).padStart(
      2,
      "0",
    );

  return `${year}-${month}-${day}`;
}

export default function LicenseLifecycleControls({
  licenseId,
  status,
  expiresAt,
}: Props) {
  const router =
    useRouter();

  const [
    reason,
    setReason,
  ] =
    useState("");

  const [
    expirationDate,
    setExpirationDate,
  ] =
    useState(
      localDateValue(
        expiresAt,
      ),
    );

  const [
    busy,
    setBusy,
  ] =
    useState<ActionName | null>(
      null,
    );

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null,
    );

  const [
    success,
    setSuccess,
  ] =
    useState<string | null>(
      null,
    );

  const [
    rotationConfirmation,
    setRotationConfirmation,
  ] =
    useState("");

  const [
    replacementCredential,
    setReplacementCredential,
  ] =
    useState<string | null>(
      null,
    );
  const [
    revokeConfirmation,
    setRevokeConfirmation,
  ] =
    useState("");
  const trimmedReason =
    reason.trim();

  const canSubmit =
    trimmedReason.length > 0 &&
    busy === null;

  const expirationChanged =
    useMemo(
      () =>
        expirationDate !==
        localDateValue(
          expiresAt,
        ),
      [
        expirationDate,
        expiresAt,
      ],
    );

  async function mutate(
    action: ActionName,
  ) {
    if (!trimmedReason) {
      setError(
        "Enter an audit reason before performing a lifecycle action.",
      );

      return;
    }

    if (
      action === "expiration" &&
      !expirationDate
    ) {
      setError(
        "Select an expiration date.",
      );

      return;
    }

    const labels: Record<
      ActionName,
      string
    > = {
      suspend:
        "suspend this deployment license",
      reactivate:
        "reactivate this deployment license",
      expiration:
        "update this deployment license expiration",
    };

    const confirmed =
      window.confirm(
        `Confirm that you want to ${labels[action]}. This action will be written to the immutable license audit history.`,
      );

    if (!confirmed) {
      return;
    }

    setBusy(action);
    setError(null);
    setSuccess(null);

    try {
      const body:
        Record<string, unknown> = {
          reason:
            trimmedReason,
        };

      if (
        action ===
        "expiration"
      ) {
        const expiration =
          new Date(
            `${expirationDate}T23:59:59.999Z`,
          );

        if (
          Number.isNaN(
            expiration.getTime(),
          )
        ) {
          throw new Error(
            "Invalid expiration date.",
          );
        }

        body.expiresAt =
          expiration.toISOString();
      }

      const response =
        await fetch(
          `/api/truvern/ops/deployment-licenses/${licenseId}/${action}`,
          {
            method: "POST",
            headers: {
              "content-type":
                "application/json",
            },
            body:
              JSON.stringify(
                body,
              ),
          },
        );

      const payload =
        (await response.json()) as {
          ok?: boolean;
          error?: string;
        };

      if (!response.ok) {
        throw new Error(
          payload.error ||
            `Lifecycle action failed with HTTP ${response.status}.`,
        );
      }

      setSuccess(
        action === "suspend"
          ? "License suspended."
          : action ===
              "reactivate"
            ? "License reactivated."
            : "Expiration updated.",
      );

      setReason("");

      router.refresh();
    }
    catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Lifecycle action failed.",
      );
    }
    finally {
      setBusy(null);
    }
  }

  async function rotateCredential() {
    if (
      status !== "ACTIVE"
    ) {
      setError(
        "Credential rotation is available only for ACTIVE licenses.",
      );

      return;
    }

    if (!trimmedReason) {
      setError(
        "Enter an audit reason before rotating the credential.",
      );

      return;
    }

    if (
      rotationConfirmation !==
      "ROTATE"
    ) {
      setError(
        'Type ROTATE exactly to confirm credential rotation.',
      );

      return;
    }

    const confirmed =
      window.confirm(
        "Rotate this deployment credential? The existing credential will stop working immediately. The replacement credential will be shown only once.",
      );

    if (!confirmed) {
      return;
    }

    setBusy(null);
    setError(null);
    setSuccess(null);
    setReplacementCredential(null);

    try {
      const response =
        await fetch(
          `/api/truvern/ops/deployment-licenses/${licenseId}/rotate`,
          {
            method: "POST",
            headers: {
              "content-type":
                "application/json",
            },
            body:
              JSON.stringify({
                reason:
                  trimmedReason,
              }),
          },
        );

      const payload =
        (await response.json()) as {
          ok?: boolean;
          error?: string;
          licenseKey?: string;
        };

      if (!response.ok) {
        throw new Error(
          payload.error ||
            `Credential rotation failed with HTTP ${response.status}.`,
        );
      }

      if (
        typeof payload.licenseKey !==
          "string" ||
        payload.licenseKey.length === 0
      ) {
        throw new Error(
          "Rotation succeeded without returning the replacement credential.",
        );
      }

      setReplacementCredential(
        payload.licenseKey,
      );

      setRotationConfirmation("");
      setReason("");

      setSuccess(
        "Credential rotated. Record the replacement credential now; it cannot be retrieved again.",
      );

      router.refresh();
    }
    catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Credential rotation failed.",
      );
    }
  }
  async function revokeLicense() {
    if (
      status === "REVOKED"
    ) {
      setError(
        "This deployment license is already revoked.",
      );

      return;
    }

    if (!trimmedReason) {
      setError(
        "Enter an audit reason before permanently revoking the license.",
      );

      return;
    }

    if (
      revokeConfirmation !==
      "REVOKE"
    ) {
      setError(
        'Type REVOKE exactly to confirm permanent revocation.',
      );

      return;
    }

    const confirmed =
      window.confirm(
        "Permanently revoke this deployment license? This cannot be undone. The deployment credential will no longer grant access.",
      );

    if (!confirmed) {
      return;
    }

    setError(null);
    setSuccess(null);
    setReplacementCredential(null);

    try {
      const response =
        await fetch(
          `/api/truvern/ops/deployment-licenses/${licenseId}/revoke`,
          {
            method: "POST",
            headers: {
              "content-type":
                "application/json",
            },
            body:
              JSON.stringify({
                reason:
                  trimmedReason,
              }),
          },
        );

      const payload =
        (await response.json()) as {
          ok?: boolean;
          error?: string;
        };

      if (!response.ok) {
        throw new Error(
          payload.error ||
            `License revocation failed with HTTP ${response.status}.`,
        );
      }

      setRevokeConfirmation("");
      setReason("");

      setSuccess(
        "Deployment license permanently revoked.",
      );

      router.refresh();
    }
    catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Deployment license revocation failed.",
      );
    }
  }
  if (
    status === "PENDING"
  ) {
    return (
      <section className="mt-8 rounded-3xl border border-cyan-400/20 bg-cyan-500/10 p-6">
        <p className="text-xs uppercase tracking-[0.3em] text-cyan-100">
          Lifecycle administration
        </p>

        <h2 className="mt-2 text-2xl font-semibold text-white">
          Pending activation
        </h2>

        <p className="mt-3 max-w-3xl text-sm leading-6 text-cyan-50/80">
          This deployment license is pending.
          Lifecycle mutation controls remain
          disabled until activation semantics
          are explicitly enabled.
        </p>
      </section>
    );
  }
  if (
    status === "REVOKED"
  ) {
    return (
      <section className="mt-8 rounded-3xl border border-red-400/20 bg-red-500/10 p-6">
        <p className="text-xs uppercase tracking-[0.3em] text-red-100">
          Lifecycle administration
        </p>

        <h2 className="mt-2 text-2xl font-semibold text-white">
          Permanently revoked
        </h2>

        <p className="mt-3 max-w-3xl text-sm leading-6 text-red-50/80">
          This deployment license is revoked.
          Lifecycle mutation controls are disabled.
        </p>
      </section>
    );
  }

  return (
    <section className="mt-8 rounded-3xl border border-cyan-400/20 bg-cyan-500/10 p-6">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-cyan-100">
          Lifecycle administration
        </p>

        <h2 className="mt-2 text-2xl font-semibold text-white">
          Controlled license actions
        </h2>

        <p className="mt-3 max-w-4xl text-sm leading-6 text-cyan-50/80">
          Every action requires an operator
          reason and is written to the
          immutable deployment-license audit
          history.
        </p>
      </div>

      <div className="mt-6">
        <label
          htmlFor="license-audit-reason"
          className="text-sm font-semibold text-slate-100"
        >
          Audit reason
        </label>

        <textarea
          id="license-audit-reason"
          value={reason}
          onChange={(event) =>
            setReason(
              event.target.value,
            )
          }
          rows={3}
          maxLength={1000}
          placeholder="Explain why this lifecycle change is required."
          className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-300/40"
        />

        <p className="mt-2 text-xs text-slate-400">
          Required for every lifecycle
          mutation.
        </p>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-slate-950/30 p-5">
          <p className="text-sm font-semibold text-white">
            Operational state
          </p>

          <p className="mt-2 text-sm leading-6 text-slate-400">
            Current state:{" "}
            <span className="font-semibold text-slate-100">
              {status}
            </span>
          </p>

          <div className="mt-4">
            {status ===
            "ACTIVE" ? (
              <button
                type="button"
                disabled={
                  !canSubmit
                }
                onClick={() =>
                  void mutate(
                    "suspend",
                  )
                }
                className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-2.5 text-sm font-semibold text-amber-100 hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {busy ===
                "suspend"
                  ? "Suspending..."
                  : "Suspend license"}
              </button>
            ) : null}

            {status ===
            "SUSPENDED" ? (
              <button
                type="button"
                disabled={
                  !canSubmit
                }
                onClick={() =>
                  void mutate(
                    "reactivate",
                  )
                }
                className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-2.5 text-sm font-semibold text-emerald-100 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {busy ===
                "reactivate"
                  ? "Reactivating..."
                  : "Reactivate license"}
              </button>
            ) : null}

            {status ===
            "EXPIRED" ? (
              <p className="text-sm text-slate-400">
                This license is expired.
                Adjust the expiration term
                before attempting further
                operational use.
              </p>
            ) : null}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-slate-950/30 p-5">
          <label
            htmlFor="license-expiration"
            className="text-sm font-semibold text-white"
          >
            Expiration
          </label>

          <p className="mt-2 text-sm leading-6 text-slate-400">
            Update the license term without
            changing its credential.
          </p>

          <input
            id="license-expiration"
            type="date"
            value={
              expirationDate
            }
            onChange={(event) =>
              setExpirationDate(
                event.target.value,
              )
            }
            className="mt-4 rounded-xl border border-white/10 bg-slate-950/60 px-4 py-2.5 text-sm text-white outline-none focus:border-cyan-300/40"
          />

          <div className="mt-4">
            <button
              type="button"
              disabled={
                !canSubmit ||
                !expirationDate ||
                !expirationChanged
              }
              onClick={() =>
                void mutate(
                  "expiration",
                )
              }
              className="rounded-xl border border-cyan-400/30 bg-cyan-500/10 px-4 py-2.5 text-sm font-semibold text-cyan-100 hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy ===
              "expiration"
                ? "Updating..."
                : "Update expiration"}
            </button>
          </div>
        </div>
      </div>

      {error ? (
        <div className="mt-5 rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="mt-5 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          {success}
        </div>
      ) : null}
      <div className="mt-6 rounded-2xl border border-amber-400/20 bg-amber-500/10 p-5">
        <p className="text-xs uppercase tracking-[0.22em] text-amber-100">
          Credential rotation
        </p>

        <h3 className="mt-2 text-lg font-semibold text-white">
          Replace deployment credential
        </h3>

        <p className="mt-2 max-w-3xl text-sm leading-6 text-amber-50/80">
          Rotation immediately invalidates the current
          deployment credential. The replacement credential
          is returned once and cannot be recovered later.
        </p>

        {status === "ACTIVE" ? (
          <>
            <div className="mt-5">
              <label
                htmlFor="license-rotation-confirmation"
                className="text-sm font-semibold text-amber-50"
              >
                Type ROTATE to confirm
              </label>

              <input
                id="license-rotation-confirmation"
                type="text"
                autoComplete="off"
                spellCheck={false}
                value={rotationConfirmation}
                onChange={(event) =>
                  setRotationConfirmation(
                    event.target.value,
                  )
                }
                placeholder="ROTATE"
                className="mt-2 w-full max-w-md rounded-xl border border-amber-300/20 bg-slate-950/60 px-4 py-2.5 font-mono text-sm text-white outline-none placeholder:text-slate-600 focus:border-amber-300/50"
              />
            </div>

            <button
              type="button"
              disabled={
                !trimmedReason ||
                rotationConfirmation !==
                  "ROTATE"
              }
              onClick={() =>
                void rotateCredential()
              }
              className="mt-4 rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-2.5 text-sm font-semibold text-amber-100 hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Rotate credential
            </button>
          </>
        ) : (
          <p className="mt-4 text-sm text-amber-50/70">
            Credential rotation is available only while the
            license is ACTIVE.
          </p>
        )}

        {replacementCredential ? (
          <div className="mt-6 rounded-2xl border border-red-300/30 bg-slate-950/70 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-red-200">
              One-time replacement credential
            </p>

            <p className="mt-2 text-sm leading-6 text-red-50/80">
              Record this value now. Truvern does not store
              the plaintext credential and cannot display it
              again after you dismiss this panel or leave the
              page.
            </p>

            <div className="mt-4 overflow-x-auto rounded-xl border border-white/10 bg-black/30 p-4">
              <code className="select-all whitespace-nowrap font-mono text-sm text-white">
                {replacementCredential}
              </code>
            </div>

            <button
              type="button"
              onClick={() =>
                setReplacementCredential(
                  null,
                )
              }
              className="mt-4 rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm font-semibold text-slate-100 hover:bg-white/[0.09]"
            >
              I have recorded it - dismiss
            </button>
          </div>
        ) : null}

        <div className="mt-5 rounded-xl border border-red-400/25 bg-red-500/10 p-5">
          <p className="text-xs uppercase tracking-[0.22em] text-red-100">
            Permanent revocation
          </p>

          <h3 className="mt-2 text-lg font-semibold text-white">
            Irreversibly revoke deployment access
          </h3>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-red-50/80">
            Revocation is permanent. The deployment credential
            will stop granting access and this license cannot
            be reactivated or rotated afterward.
          </p>

          <div className="mt-5">
            <label
              htmlFor="license-revoke-confirmation"
              className="text-sm font-semibold text-red-50"
            >
              Type REVOKE to confirm
            </label>

            <input
              id="license-revoke-confirmation"
              type="text"
              autoComplete="off"
              spellCheck={false}
              value={revokeConfirmation}
              onChange={(event) =>
                setRevokeConfirmation(
                  event.target.value,
                )
              }
              placeholder="REVOKE"
              className="mt-2 w-full max-w-md rounded-xl border border-red-300/20 bg-slate-950/60 px-4 py-2.5 font-mono text-sm text-white outline-none placeholder:text-slate-600 focus:border-red-300/50"
            />
          </div>

          <button
            type="button"
            disabled={
              !trimmedReason ||
              revokeConfirmation !==
                "REVOKE"
            }
            onClick={() =>
              void revokeLicense()
            }
            className="mt-4 rounded-xl border border-red-400/40 bg-red-500/15 px-4 py-2.5 text-sm font-semibold text-red-100 hover:bg-red-500/25 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Permanently revoke license
          </button>
        </div>
      </div>
    </section>
  );
}