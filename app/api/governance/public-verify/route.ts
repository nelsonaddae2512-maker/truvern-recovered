import { NextResponse } from "next/server";
import {
  verifyGovernanceSignature,
  type GovernanceSignatureBundle,
} from "@/lib/governance/signing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function safeStr(v: unknown) {
  return typeof v === "string" ? v.trim() : "";
}

function isObject(v: unknown): v is Record<string, any> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const bundle = isObject(body?.bundle) ? body.bundle : null;
    const manifest = isObject(body?.manifest) ? body.manifest : null;

    const source = bundle || manifest;

    if (!source) {
      return NextResponse.json(
        {
          ok: false,
          verified: false,
          error: "Paste a verification bundle or release manifest JSON.",
        },
        { status: 400 },
      );
    }

    const payload = isObject(bundle?.manifest)
      ? bundle.manifest
      : manifest
        ? {
            ok: manifest.ok,
            manifestVersion: manifest.manifestVersion,
            artifactType: manifest.artifactType,
            assignmentId: manifest.assignmentId,
            responseId: manifest.responseId,
            vendorId: manifest.vendorId,
            vendorName: manifest.vendorName,
            releaseState: manifest.releaseState,
            sealedAt: manifest.sealedAt,
            checksum: manifest.checksum,
            checksumAlgorithm: manifest.checksumAlgorithm,
            sealVersion: manifest.sealVersion,
            verification: manifest.verification,
            artifacts: manifest.artifacts,
            evidenceSummary: manifest.evidenceSummary,
            snapshot: manifest.snapshot,
          }
        : null;

    const signature = isObject(bundle?.signature)
      ? bundle.signature
      : isObject(manifest?.signature)
        ? manifest.signature
        : null;

    if (!payload || !signature) {
      return NextResponse.json(
        {
          ok: false,
          verified: false,
          error: "Artifact is missing a payload or signature bundle.",
        },
        { status: 400 },
      );
    }

    const signatureValid = verifyGovernanceSignature(
      payload,
      signature as GovernanceSignatureBundle,
    );

    const checksum = safeStr(payload.checksum);
    const releaseState = safeStr(payload.releaseState);

    const transparencyIncluded =
      !!safeStr(bundle?.manifest?.checksum) ||
      !!safeStr(manifest?.checksum);

    const checkpointValid =
      !!safeStr(bundle?.merkleRoot) ||
      !!safeStr(manifest?.merkleRoot);

    return NextResponse.json(
      {
        ok: true,
        verified: signatureValid && !!checksum,
        signatureValid,
        checksumPresent: !!checksum,
        transparencyIncluded,
        checkpointValid,

        checksum: checksum || null,
        releaseState: releaseState || null,

        latestEntryHash:
          safeStr(bundle?.latestEntryHash) ||
          safeStr(manifest?.latestEntryHash) ||
          null,

        merkleRoot:
          safeStr(bundle?.merkleRoot) ||
          safeStr(manifest?.merkleRoot) ||
          null,
      },
      {
        headers: {
          "cache-control": "no-store",
        },
      },
    );
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        verified: false,
        error:
          safeStr(error?.message) ||
          "Failed to verify governance artifact.",
      },
      { status: 500 },
    );
  }
}

