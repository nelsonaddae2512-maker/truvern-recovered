import crypto from "crypto";
import { NextResponse } from "next/server";

import {
  ACTIVE_TRUVERN_GOVERNANCE_SIGNING_KEY_ID,
  listGovernanceSigningKeys,
  readGovernancePublicKey,
} from "@/lib/governance-signing-keys";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const keys =
      listGovernanceSigningKeys().map(
        (key) => {

          const publicKeyPem =
            readGovernancePublicKey(
              key.keyId,
            );

          const publicKeyFingerprint =
            crypto
              .createHash(
                "sha256",
              )
              .update(
                publicKeyPem,
                "utf8",
              )
              .digest(
                "hex",
              );

          return {
            keyId:
              key.keyId,

            algorithm:
              key.algorithm,

            status:
              key.active
                ? "ACTIVE"
                : "RETAINED",

            publicKeyFingerprint,

            publicKeyPem,
          };
        },
      );

    return NextResponse.json(
      {
        schema:
          "truvern.framework-governance.signing-keys.v1",

        algorithmFamily:
          "RSA-SHA256",

        activeKeyId:
          ACTIVE_TRUVERN_GOVERNANCE_SIGNING_KEY_ID,

        verificationRule:
          "Select the public key whose keyId exactly matches the persisted release signature keyId.",

        keys,
      },
      {
        headers: {
          "cache-control":
            "public, max-age=300, stale-while-revalidate=3600",
        },
      },
    );
  }
  catch (error: any) {

    return NextResponse.json(
      {
        ok:
          false,

        error:
          typeof error?.message === "string"
            ? error.message
            : "Framework signing-key discovery unavailable.",
      },
      {
        status:
          500,

        headers: {
          "cache-control":
            "no-store",
        },
      },
    );
  }
}