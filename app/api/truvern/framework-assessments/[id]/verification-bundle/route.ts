import crypto from "crypto";
import { NextResponse } from "next/server";

import prisma from "@/lib/prisma";

import {
  governanceAuthErrorResponse,
} from "@/lib/auth/governance-auth-errors";

import {
  requireReleasePacketAccess,
} from "@/lib/auth/truvern-governance";

import {
  listGovernanceSigningKeys,
  readGovernancePublicKey,
} from "@/lib/governance-signing-keys";

import {
  verifyFrameworkReleaseOffline,
} from "@/lib/governance/offline-framework-release-verifier";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function parseId(
  value: unknown,
) {
  const id =
    Number(
      value,
    );

  return Number.isInteger(id) &&
    id > 0
      ? id
      : null;
}

export async function GET(
  _request: Request,
  context: RouteContext,
) {
  try {
    const {
      id: rawId,
    } =
      await context.params;

    const assessmentId =
      parseId(
        rawId,
      );

    if (!assessmentId) {
      return NextResponse.json(
        {
          ok:
            false,

          error:
            "Invalid assessment id.",
        },
        {
          status:
            400,
        },
      );
    }

    await requireReleasePacketAccess(
      assessmentId,
    );

    const assessment =
      await prisma
        .truvernFrameworkAssessment
        .findUnique({
          where: {
            id:
              assessmentId,
          },

          select: {
            id:
              true,

            title:
              true,

            metadata:
              true,
          },
        });

    if (!assessment) {
      return NextResponse.json(
        {
          ok:
            false,

          error:
            "Assessment not found.",
        },
        {
          status:
            404,
        },
      );
    }

    const metadata =
      assessment.metadata &&
      typeof assessment.metadata === "object" &&
      !Array.isArray(
        assessment.metadata,
      )
        ? assessment.metadata as Record<
            string,
            any
          >
        : {};

    const governanceReleaseSnapshot =
      metadata
        .governanceReleaseSnapshot ??
      null;

    const governanceSeal =
      metadata
        .governanceSeal ??
      null;

    if (
      !governanceReleaseSnapshot ||
      !governanceSeal
    ) {
      return NextResponse.json(
        {
          ok:
            false,

          error:
            "Assessment has not been released and sealed.",
        },
        {
          status:
            409,
        },
      );
    }

    const keys =
      listGovernanceSigningKeys()
        .map(
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

    const signingKeys = {
      schema:
        "truvern.framework-governance.signing-keys.v1",

      algorithmFamily:
        "RSA-SHA256",

      verificationRule:
        "Select the public key whose keyId exactly matches the persisted release signature keyId.",

      keys,
    };

    /*
     * Refuse to export a bundle that cannot independently verify
     * using only the public data that will be included in it.
     */
    const verification =
      verifyFrameworkReleaseOffline({
        governanceReleaseSnapshot,

        governanceSeal,

        signingKeys,
      });

    if (
      !verification
        .independentlyVerified
    ) {
      return NextResponse.json(
        {
          ok:
            false,

          error:
            "Persisted release failed portable verification before export.",

          verification,
        },
        {
          status:
            409,

          headers: {
            "cache-control":
              "no-store",
          },
        },
      );
    }

    const filename =
      `truvern-framework-release-${assessment.id}-verification-bundle.json`;

    return NextResponse.json(
      {
        schema:
          "truvern.framework-governance.verification-bundle.v1",

        exportedAt:
          new Date()
            .toISOString(),

        assessment: {
          id:
            assessment.id,

          /*
           * Human-readable export label only.
           * Cryptographic verification never depends on this field.
           */
          exportLabel:
            assessment.title,
        },

        governanceReleaseSnapshot,

        governanceSeal,

        signingKeys,

        verification: {
          independentlyVerified:
            verification
              .independentlyVerified,

          checksumVerified:
            verification
              .checksumVerified,

          payloadHashVerified:
            verification
              .payloadHashVerified,

          publicKeyFingerprintVerified:
            verification
              .publicKeyFingerprintVerified,

          cryptographicVerified:
            verification
              .cryptographicVerified,

          keyId:
            verification
              .keyId,

          algorithm:
            verification
              .algorithm,

          calculatedChecksum:
            verification
              .calculatedChecksum,
        },

        instructions: {
          canonicalization:
            "Recursively sort object property names. Preserve array ordering. Serialize as JSON with no formatting whitespace.",

          checksum:
            "Compute SHA-256 over the UTF-8 canonical JSON bytes of governanceReleaseSnapshot.",

          checksumComparison:
            "Calculated SHA-256 must equal governanceSeal.checksum and governanceSeal.cryptographicSignature.payloadHash.",

          keySelection:
            "Select signingKeys.keys[] using governanceSeal.cryptographicSignature.keyId.",

          fingerprint:
            "Compute SHA-256 over the exact UTF-8 publicKeyPem bytes and compare with publicKeyFingerprint.",

          signature:
            "Verify governanceSeal.cryptographicSignature.signature as base64 RSA-SHA256 over the canonical snapshot bytes.",

          success:
            "Checksum, payloadHash, public-key fingerprint, and RSA signature must all verify.",
        },
      },
      {
        headers: {
          "cache-control":
            "private, no-store",

          "content-disposition":
            `attachment; filename="${filename}"`,
        },
      },
    );
  }
  catch (error) {

    const authError =
      governanceAuthErrorResponse(
        error,
      );

    if (authError) {
      return authError;
    }

    console.error(
      "Framework verification bundle export failed.",
      error,
    );

    return NextResponse.json(
      {
        ok:
          false,

        error:
          "Unable to export framework release verification bundle.",
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