"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AddVendorEmailModal from "@/components/evidence/add-vendor-email-modal.client";

function clsx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export default function EvidenceInboxActionsClient({
  requestId,
  status,
  vendorId,
  vendorName,
  vendorContactName,
  vendorContactEmail,
}: {
  requestId: number;
  status: string;
  vendorId: number | null;
  vendorName: string;
  vendorContactName: string | null;
  vendorContactEmail: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const hasEmail = useMemo(
    () => !!(vendorContactEmail && vendorContactEmail.trim()),
    [vendorContactEmail]
  );

  // If you already have a working €œsend reminder€ route, keep it here.
  // This implementation uses your existing API per-request route ONLY if you add it.
  // For now, keep button behavior consistent: enabled only when OPEN + email exists.
  async function sendOne() {
    try {
      // If you have an existing per-request endpoint, plug it in here:
      // await fetch(`/api/evidence-requests/${requestId}/send-reminder`, { method: "POST" });
      // router.refresh();

      // Fallback: just navigate to the request detail (safe).
      router.push(`/org/evidence-requests/${requestId}`);
    } catch {
      router.push(`/org/evidence-requests/${requestId}`);
    }
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <Link className="btn-glass" href={`/org/evidence-requests/${requestId}`}>
          View
        </Link>

        {status === "OPEN" ? (
          <>
            <button
              className={clsx("btn-primary", !hasEmail && "opacity-50 cursor-not-allowed")}
              onClick={sendOne}
              disabled={!hasEmail}
              title={!hasEmail ? "Vendor contact email required" : "Send reminder"}
            >
              Send Reminder
            </button>

            {!hasEmail ? (
              <button
                className="text-xs text-muted-foreground underline underline-offset-4"
                onClick={() => setOpen(true)}
              >
                Add email
              </button>
            ) : null}
          </>
        ) : (
          <span className="text-xs text-muted-foreground">€”</span>
        )}
      </div>

      <AddVendorEmailModal
        open={open}
        onClose={() => setOpen(false)}
        vendorId={vendorId}
        vendorName={vendorName}
        initialName={vendorContactName}
        initialEmail={vendorContactEmail}
      />
    </>
  );
}


