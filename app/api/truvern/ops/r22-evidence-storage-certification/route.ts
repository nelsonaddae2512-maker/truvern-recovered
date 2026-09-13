import { NextResponse } from "next/server";

import { requireOpsAccess } from "@/lib/auth/truvern-governance";
import {
  extractTrustedEvidenceText,
  readTrustedVendorEvidenceObject,
} from "@/lib/storage/evidence-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const CERTIFICATION = "R22.7F.10CE-R255I1";
const EVIDENCE_ID = 22;
const VENDOR_ID = 21;
const EVIDENCE_REQUEST_ID = 36;
const EVIDENCE_KEY =
  "truvern/vendor-evidence/21/requests/36/1788873748464-au1.txt";

export async function GET() {
  await requireOpsAccess();

  try {
    const object = await readTrustedVendorEvidenceObject({
      key: EVIDENCE_KEY,
      vendorId: VENDOR_ID,
      evidenceRequestId: EVIDENCE_REQUEST_ID,
    });

    const extracted = extractTrustedEvidenceText(object);

    return NextResponse.json(
      {
        ok: true,
        certification: CERTIFICATION,
        target: {
          evidenceId: EVIDENCE_ID,
          vendorId: VENDOR_ID,
          evidenceRequestId: EVIDENCE_REQUEST_ID,
        },
        storage: {
          objectRead: true,
          trustedScopeValidated: true,
          contentType: object.contentType,
          contentLength: object.contentLength,
          returnedByteLength: object.bytes.byteLength,
        },
        extraction: {
          status: extracted.extractionStatus,
          mediaType: extracted.mediaType,
          byteLength: extracted.byteLength,
          textPresent:
            extracted.extractionStatus === "TEXT_AVAILABLE" &&
            typeof extracted.text === "string" &&
            extracted.text.length > 0,
        },
        evidenceTextReturned: false,
        storageKeyReturned: false,
        databaseQueried: false,
        workerInvoked: false,
        providerInvoked: false,
        modelCalled: false,
        recoveryInvoked: false,
        canaryExecuted: false,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch {
    return NextResponse.json(
      {
        ok: false,
        certification: CERTIFICATION,
        error: "Trusted evidence storage certification failed.",
        evidenceTextReturned: false,
        storageKeyReturned: false,
        databaseQueried: false,
        workerInvoked: false,
        providerInvoked: false,
        modelCalled: false,
        recoveryInvoked: false,
        canaryExecuted: false,
      },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }
}