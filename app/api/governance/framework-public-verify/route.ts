import { NextResponse } from "next/server";

import {
  verifyFrameworkReleaseOffline,
} from "@/lib/governance/offline-framework-release-verifier";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(
  request: Request,
) {
  try {
    const body =
      await request.json();

    const bundle =
      body?.bundle;

    if (
      !bundle ||
      typeof bundle !== "object" ||
      Array.isArray(bundle)
    ) {
      return NextResponse.json(
        {
          ok:
            false,

          verified:
            false,

          error:
            "A Truvern framework verification bundle is required.",
        },
        {
          status:
            400,

          headers: {
            "cache-control":
              "no-store",
          },
        },
      );
    }

    if (
      bundle.schema !==
      "truvern.framework-governance.verification-bundle.v1"
    ) {
      return NextResponse.json(
        {
          ok:
            false,

          verified:
            false,

          error:
            "Unsupported framework verification bundle schema.",
        },
        {
          status:
            400,

          headers: {
            "cache-control":
              "no-store",
          },
        },
      );
    }

    const result =
      verifyFrameworkReleaseOffline({
        governanceReleaseSnapshot:
          bundle.governanceReleaseSnapshot,

        governanceSeal:
          bundle.governanceSeal,

        signingKeys:
          bundle.signingKeys,
      });

    return NextResponse.json(
      {
        ok:
          true,

        verified:
          result.independentlyVerified,

        independentlyVerified:
          result.independentlyVerified,

        checksumVerified:
          result.checksumVerified,

        payloadHashVerified:
          result.payloadHashVerified,

        publicKeyFingerprintVerified:
          result.publicKeyFingerprintVerified,

        cryptographicVerified:
          result.cryptographicVerified,

        keyId:
          result.keyId,

        algorithm:
          result.algorithm,

        calculatedChecksum:
          result.calculatedChecksum,

        reason:
          result.reason,

        schema:
          bundle.schema,

        releaseSchema:
          bundle
            ?.governanceReleaseSnapshot
            ?.schema ??
          null,
      },
      {
        headers: {
          "cache-control":
            "no-store",
        },
      },
    );
  }
  catch {

    return NextResponse.json(
      {
        ok:
          false,

        verified:
          false,

        error:
          "Unable to parse or verify the framework verification bundle.",
      },
      {
        status:
          400,

        headers: {
          "cache-control":
            "no-store",
        },
      },
    );
  }
}