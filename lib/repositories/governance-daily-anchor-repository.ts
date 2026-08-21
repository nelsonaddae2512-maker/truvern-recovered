import { Prisma } from "@prisma/client";
import type { GovernanceDailyAnchor } from "@prisma/client";

import prisma from "@/lib/prisma";

type GovernanceDailyAnchorClient = Pick<
  Prisma.TransactionClient,
  "governanceDailyAnchor"
>;

export type PersistGovernanceDailyAnchorInput = {
  anchorDate: Date;
  anchorType: string;
  version: string;
  entryCount: number;
  merkleRoot: string;
  canonicalPayload: string;
  payloadHash: string;
  signature: string;
  signatureAlgorithm: string;
  publicKeyId: string;
  signedAt: Date;
  generatedAt: Date;
};

export type PersistGovernanceDailyAnchorResult = {
  anchor: GovernanceDailyAnchor;
  created: boolean;
};

export class GovernanceDailyAnchorConflictError extends Error {
  constructor(anchorDate: Date) {
    super(
      `Governance daily anchor already exists with different immutable content for ${anchorDate
        .toISOString()
        .slice(0, 10)}.`,
    );

    this.name = "GovernanceDailyAnchorConflictError";
  }
}

function sameDateValue(left: Date, right: Date) {
  return left.getTime() === right.getTime();
}

function matchesImmutableAnchor(
  existing: GovernanceDailyAnchor,
  input: PersistGovernanceDailyAnchorInput,
) {
  return (
    sameDateValue(existing.anchorDate, input.anchorDate) &&
    existing.anchorType === input.anchorType &&
    existing.version === input.version &&
    existing.entryCount === input.entryCount &&
    existing.merkleRoot === input.merkleRoot &&
    existing.canonicalPayload === input.canonicalPayload &&
    existing.payloadHash === input.payloadHash &&
    existing.signature === input.signature &&
    existing.signatureAlgorithm === input.signatureAlgorithm &&
    existing.publicKeyId === input.publicKeyId &&
    sameDateValue(existing.signedAt, input.signedAt) &&
    sameDateValue(existing.generatedAt, input.generatedAt)
  );
}

export async function readGovernanceDailyAnchorByDate(
  anchorDate: Date,
  client: GovernanceDailyAnchorClient = prisma,
): Promise<GovernanceDailyAnchor | null> {
  return client.governanceDailyAnchor.findUnique({
    where: {
      anchorDate,
    },
  });
}

export async function persistGovernanceDailyAnchorIfAbsent(
  input: PersistGovernanceDailyAnchorInput,
  client: GovernanceDailyAnchorClient = prisma,
): Promise<PersistGovernanceDailyAnchorResult> {
  const existing =
    await readGovernanceDailyAnchorByDate(
      input.anchorDate,
      client,
    );

  if (existing) {
    if (!matchesImmutableAnchor(existing, input)) {
      throw new GovernanceDailyAnchorConflictError(
        input.anchorDate,
      );
    }

    return {
      anchor: existing,
      created: false,
    };
  }

  try {
    const anchor =
      await client.governanceDailyAnchor.create({
        data: {
          anchorDate: input.anchorDate,
          anchorType: input.anchorType,
          version: input.version,
          entryCount: input.entryCount,
          merkleRoot: input.merkleRoot,
          canonicalPayload: input.canonicalPayload,
          payloadHash: input.payloadHash,
          signature: input.signature,
          signatureAlgorithm: input.signatureAlgorithm,
          publicKeyId: input.publicKeyId,
          signedAt: input.signedAt,
          generatedAt: input.generatedAt,
        },
      });

    return {
      anchor,
      created: true,
    };
  } catch (error) {
    /*
     * anchorDate is UNIQUE. Two workers may race:
     *
     *   worker A: findUnique -> null
     *   worker B: findUnique -> null
     *   worker A: create -> success
     *   worker B: create -> P2002
     *
     * Re-read the winner and accept it only when its immutable
     * cryptographic content exactly matches this request.
     */
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const raced =
        await readGovernanceDailyAnchorByDate(
          input.anchorDate,
          client,
        );

      if (
        raced &&
        matchesImmutableAnchor(raced, input)
      ) {
        return {
          anchor: raced,
          created: false,
        };
      }

      throw new GovernanceDailyAnchorConflictError(
        input.anchorDate,
      );
    }

    throw error;
  }
}