import crypto from "crypto";
import { describe, expect, it } from "vitest";

import {
  getActiveGovernanceSigningKey,
  readGovernancePrivateKey,
  readGovernancePublicKey,
  TRUVERN_GOVERNANCE_RSA_V1_KEY_ID,
  TRUVERN_GOVERNANCE_RSA_V2_KEY_ID,
} from "@/lib/governance-signing-keys";

import {
  signGovernancePayload,
  verifyGovernanceSignature,
} from "@/lib/governance-signature";

describe("versioned governance signing keys", () => {
  const payload = {
    type: "TRUVERN_SIGNING_REGRESSION",
    version: "RS-24B.11",
    assignmentId: 424242,
    checksum: "test-checksum",
  };

  function signWithKey(keyId: string) {
    const privateKey =
      readGovernancePrivateKey(keyId);

    const canonical =
      JSON.stringify(payload);

    return crypto
      .sign(
        "sha256",
        Buffer.from(canonical, "utf8"),
        privateKey,
      )
      .toString("base64");
  }

  function verifyDirect(
    signatureBase64: string,
    keyId: string,
  ) {
    const publicKey =
      readGovernancePublicKey(keyId);

    return crypto.verify(
      "sha256",
      Buffer.from(
        JSON.stringify(payload),
        "utf8",
      ),
      publicKey,
      Buffer.from(signatureBase64, "base64"),
    );
  }

  it("uses v2 as the active signer after cutover", () => {
    expect(
      getActiveGovernanceSigningKey().keyId,
    ).toBe(
      TRUVERN_GOVERNANCE_RSA_V2_KEY_ID,
    );

    const signed =
      signGovernancePayload(payload);

    expect(signed.keyId).toBe(
      TRUVERN_GOVERNANCE_RSA_V2_KEY_ID,
    );
  });

  it("verifies v1 only with v1", () => {
    const signature =
      signWithKey(
        TRUVERN_GOVERNANCE_RSA_V1_KEY_ID,
      );

    expect(
      verifyDirect(
        signature,
        TRUVERN_GOVERNANCE_RSA_V1_KEY_ID,
      ),
    ).toBe(true);

    expect(
      verifyDirect(
        signature,
        TRUVERN_GOVERNANCE_RSA_V2_KEY_ID,
      ),
    ).toBe(false);

    expect(
      verifyGovernanceSignature(
        payload,
        signature,
        TRUVERN_GOVERNANCE_RSA_V1_KEY_ID,
      ),
    ).toBe(true);

    expect(
      verifyGovernanceSignature(
        payload,
        signature,
        TRUVERN_GOVERNANCE_RSA_V2_KEY_ID,
      ),
    ).toBe(false);
  });

  it("verifies v2 only with v2", () => {
    const signature =
      signWithKey(
        TRUVERN_GOVERNANCE_RSA_V2_KEY_ID,
      );

    expect(
      verifyDirect(
        signature,
        TRUVERN_GOVERNANCE_RSA_V2_KEY_ID,
      ),
    ).toBe(true);

    expect(
      verifyDirect(
        signature,
        TRUVERN_GOVERNANCE_RSA_V1_KEY_ID,
      ),
    ).toBe(false);

    expect(
      verifyGovernanceSignature(
        payload,
        signature,
        TRUVERN_GOVERNANCE_RSA_V2_KEY_ID,
      ),
    ).toBe(true);

    expect(
      verifyGovernanceSignature(
        payload,
        signature,
        TRUVERN_GOVERNANCE_RSA_V1_KEY_ID,
      ),
    ).toBe(false);
  });

  it("uses distinct v1 and v2 public keys", () => {
    expect(
      readGovernancePublicKey(
        TRUVERN_GOVERNANCE_RSA_V1_KEY_ID,
      ),
    ).not.toBe(
      readGovernancePublicKey(
        TRUVERN_GOVERNANCE_RSA_V2_KEY_ID,
      ),
    );
  });
});


