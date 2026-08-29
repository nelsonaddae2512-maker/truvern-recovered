"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  vendorId: number;
  contactId: number;
  contactName: string;
  isPrimary: boolean;
};

export default function VendorContactActions({
  vendorId,
  contactId,
  contactName,
  isPrimary,
}: Props) {
  const router = useRouter();

  const [pendingAction, setPendingAction] =
    useState<"primary" | "delete" | null>(null);

  const [error, setError] =
    useState<string | null>(null);

  async function setPrimary() {
    if (pendingAction) {
      return;
    }

    setPendingAction("primary");
    setError(null);

    try {
      const response = await fetch(
        `/api/vendors/${vendorId}/contacts/${contactId}`,
        {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            action: "set-primary",
          }),
        },
      );

      const payload =
        (await response.json().catch(() => ({}))) as {
          error?: string;
        };

      if (!response.ok) {
        throw new Error(
          payload.error ||
            "Unable to set primary contact.",
        );
      }

      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to set primary contact.",
      );
    } finally {
      setPendingAction(null);
    }
  }

  async function deleteContact() {
    if (pendingAction || isPrimary) {
      return;
    }

    const confirmed =
      window.confirm(
        `Delete ${contactName} from this vendor's contacts?`,
      );

    if (!confirmed) {
      return;
    }

    setPendingAction("delete");
    setError(null);

    try {
      const response = await fetch(
        `/api/vendors/${vendorId}/contacts/${contactId}`,
        {
          method: "DELETE",
        },
      );

      const payload =
        (await response.json().catch(() => ({}))) as {
          error?: string;
        };

      if (!response.ok) {
        throw new Error(
          payload.error ||
            "Unable to delete vendor contact.",
        );
      }

      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to delete vendor contact.",
      );
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <div className="mt-4 border-t border-white/10 pt-4">
      <div className="flex flex-wrap items-center gap-2">
        {!isPrimary ? (
          <button
            type="button"
            onClick={setPrimary}
            disabled={pendingAction !== null}
            className="rounded-xl border border-cyan-300/25 bg-cyan-300/10 px-3 py-2 text-xs font-medium text-cyan-100 transition hover:bg-cyan-300/15 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pendingAction === "primary"
              ? "Updating..."
              : "Set as primary"}
          </button>
        ) : null}

        <button
          type="button"
          onClick={deleteContact}
          disabled={isPrimary || pendingAction !== null}
          title={
            isPrimary
              ? "Select another primary contact before deleting this contact."
              : `Delete ${contactName}`
          }
          className="rounded-xl border border-rose-300/20 bg-rose-300/[0.06] px-3 py-2 text-xs font-medium text-rose-100 transition hover:bg-rose-300/10 disabled:cursor-not-allowed disabled:opacity-35"
        >
          {pendingAction === "delete"
            ? "Deleting..."
            : "Delete"}
        </button>
      </div>

      {isPrimary ? (
        <p className="mt-2 text-xs text-slate-500">
          Select another primary contact before deleting this contact.
        </p>
      ) : null}

      {error ? (
        <p className="mt-2 text-xs text-rose-200">
          {error}
        </p>
      ) : null}
    </div>
  );
}