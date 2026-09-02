import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { governanceAuthErrorResponse } from "@/lib/auth/governance-auth-errors";
import { requireReviewerAccess } from "@/lib/auth/truvern-governance";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = {
  params: Promise<{ id: string }> | { id: string };
};

function safeStr(value: unknown) {
  return String(value ?? "").trim();
}

function asObject(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, any>)
    : {};
}

function hasOwn(value: object, key: string) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function normalizeStringArray(value: unknown): string[] | null {
  if (Array.isArray(value)) {
    return value
      .map((item) => safeStr(item))
      .filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(/\r?\n/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return null;
}

function canAccessPackage(
  actor: Awaited<ReturnType<typeof requireReviewerAccess>>,
  pkg: { organizationId: number },
) {
  if (actor.role === "OPS") {
    return true;
  }

  if (actor.role !== "REVIEWER") {
    return false;
  }

  if (actor.organizationId == null) {
    return true;
  }

  return actor.organizationId === pkg.organizationId;
}

async function loadPackage(packageId: number) {
  return prisma.remediationPackage.findUnique({
    where: {
      id: packageId,
    },
    select: {
      id: true,
      reviewAssignmentId: true,
      vendorId: true,
      organizationId: true,
      evidenceRequestId: true,
      sourceKey: true,
      title: true,
      status: true,
      severity: true,
      dueAt: true,
      payload: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function GET(
  _request: Request,
  props: Props,
) {
  try {
    const actor = await requireReviewerAccess();
    const resolved = await props.params;
    const packageId = Number(resolved.id);

    if (!Number.isFinite(packageId) || packageId <= 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "Remediation package id required.",
        },
        {
          status: 400,
        },
      );
    }

    const pkg = await loadPackage(packageId);

    if (!pkg) {
      return NextResponse.json(
        {
          ok: false,
          error: "Remediation package not found.",
        },
        {
          status: 404,
        },
      );
    }

    if (!canAccessPackage(actor, pkg)) {
      return NextResponse.json(
        {
          ok: false,
          error: "Reviewer does not have access to this remediation package.",
        },
        {
          status: 403,
        },
      );
    }

    return NextResponse.json({
      ok: true,
      package: pkg,
    });
  } catch (error: any) {
    const authError =
      governanceAuthErrorResponse(error);

    if (authError) {
      return authError;
    }
    return NextResponse.json(
      {
        ok: false,
        error: String(
          error?.message ||
            "Unable to read remediation package.",
        ),
      },
      {
        status: 500,
      },
    );
  }
}

export async function PATCH(
  request: Request,
  props: Props,
) {
  try {
    const actor = await requireReviewerAccess();
    const resolved = await props.params;
    const packageId = Number(resolved.id);

    if (!Number.isFinite(packageId) || packageId <= 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "Remediation package id required.",
        },
        {
          status: 400,
        },
      );
    }

    const pkg = await loadPackage(packageId);

    if (!pkg) {
      return NextResponse.json(
        {
          ok: false,
          error: "Remediation package not found.",
        },
        {
          status: 404,
        },
      );
    }

    if (!canAccessPackage(actor, pkg)) {
      return NextResponse.json(
        {
          ok: false,
          error: "Reviewer does not have access to this remediation package.",
        },
        {
          status: 403,
        },
      );
    }

    const body =
      asObject(
        await request
          .json()
          .catch(() => ({})),
      );

    const editableKeys = [
      "title",
      "severity",
      "summary",
      "recommendation",
      "requiredEvidence",
      "requiredAttestations",
      "releaseImpact",
      "evidenceSignal",
      "vendorTitle",
      "vendorSummary",
      "vendorInstructions",
      "dueAt",
    ];

    const changedFields =
      editableKeys.filter((key) =>
        hasOwn(body, key),
      );

    if (changedFields.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "No editable remediation fields supplied.",
        },
        {
          status: 400,
        },
      );
    }

    const currentPayload =
      asObject(pkg.payload);

    const nextTitle =
      hasOwn(body, "title")
        ? safeStr(body.title)
        : safeStr(pkg.title);

    if (!nextTitle) {
      return NextResponse.json(
        {
          ok: false,
          error: "Finding title cannot be empty.",
        },
        {
          status: 400,
        },
      );
    }

    const nextSeverity =
      hasOwn(body, "severity")
        ? safeStr(body.severity).toUpperCase() || null
        : safeStr(pkg.severity) || null;

    let nextDueAt: Date | null =
      pkg.dueAt;

    if (hasOwn(body, "dueAt")) {
      const rawDueAt =
        safeStr(body.dueAt);

      if (!rawDueAt) {
        nextDueAt = null;
      } else {
        const parsed =
          new Date(rawDueAt);

        if (Number.isNaN(parsed.getTime())) {
          return NextResponse.json(
            {
              ok: false,
              error: "Invalid remediation due date.",
            },
            {
              status: 400,
            },
          );
        }

        nextDueAt = parsed;
      }
    }

    const arrayKeys =
      [
        "requiredEvidence",
        "requiredAttestations",
      ] as const;

    const normalizedArrays:
      Record<string, string[]> = {};

    for (const key of arrayKeys) {
      if (!hasOwn(body, key)) {
        continue;
      }

      const normalized =
        normalizeStringArray(body[key]);

      if (!normalized) {
        return NextResponse.json(
          {
            ok: false,
            error:
              `${key} must be an array or newline-separated text.`,
          },
          {
            status: 400,
          },
        );
      }

      normalizedArrays[key] =
        normalized;
    }

    const generatedBaseline =
      currentPayload.generatedBaseline &&
      typeof currentPayload.generatedBaseline === "object"
        ? currentPayload.generatedBaseline
        : {
            title: pkg.title,
            severity: pkg.severity,
            dueAt:
              pkg.dueAt?.toISOString() ??
              null,
            payload: currentPayload,
          };

    const priorHistory =
      Array.isArray(
        currentPayload.reviewerEditHistory,
      )
        ? currentPayload.reviewerEditHistory
        : [];

    const editRecord = {
      editedAt: new Date().toISOString(),
      editedBy: actor.userId,
      editedByRole: actor.role,
      fields: changedFields,
    };

    const nextPayload: Record<string, any> = {
      ...currentPayload,

      // Stable source identity remains server-owned.
      sourceKey:
        safeStr(currentPayload.sourceKey) ||
        pkg.sourceKey,

      title: nextTitle,
      severity: nextSeverity,
      dueAt:
        nextDueAt?.toISOString() ??
        null,

      generatedBaseline,

      reviewerOverride: {
        active: true,
        updatedAt: editRecord.editedAt,
        updatedBy: actor.userId,
        updatedByRole: actor.role,
        fields: Array.from(
          new Set([
            ...(
              Array.isArray(
                currentPayload
                  ?.reviewerOverride
                  ?.fields,
              )
                ? currentPayload
                    .reviewerOverride
                    .fields
                    .map((value: unknown) =>
                      safeStr(value),
                    )
                    .filter(Boolean)
                : []
            ),
            ...changedFields,
          ]),
        ),
      },

      reviewerEditHistory: [
        ...priorHistory,
        editRecord,
      ].slice(-100),
    };

    for (const key of [
      "summary",
      "recommendation",
      "releaseImpact",
      "evidenceSignal",
      "vendorTitle",
      "vendorSummary",
      "vendorInstructions",
    ]) {
      if (hasOwn(body, key)) {
        nextPayload[key] =
          safeStr(body[key]);
      }
    }

    for (const key of arrayKeys) {
      if (hasOwn(body, key)) {
        nextPayload[key] =
          normalizedArrays[key] ?? [];
      }
    }

    const requiredEvidence =
      normalizeStringArray(
        nextPayload.requiredEvidence,
      ) ?? [];

    const requiredAttestations =
      normalizeStringArray(
        nextPayload.requiredAttestations,
      ) ?? [];

    const vendorTitle =
      safeStr(nextPayload.vendorTitle) ||
      nextTitle;

    const vendorDescription =
      [
        safeStr(
          nextPayload.vendorInstructions,
        ),
        safeStr(
          nextPayload.vendorSummary,
        ),
        safeStr(
          nextPayload.summary,
        ),
        requiredEvidence.length > 0
          ? `Required evidence: ${requiredEvidence.join("; ")}`
          : "",
        requiredAttestations.length > 0
          ? `Required attestation: ${requiredAttestations.join("; ")}`
          : "",
      ]
        .filter(Boolean)
        .join("\n\n");

    const payloadForWrite =
      JSON.parse(
        JSON.stringify(nextPayload),
      ) as Prisma.InputJsonValue;

    const updated =
      await prisma.$transaction(
        async (tx) => {
          const packageRow =
            await tx.remediationPackage.update({
              where: {
                id: pkg.id,
              },
              data: {
                title: nextTitle,
                severity: nextSeverity,
                dueAt: nextDueAt,
                payload: payloadForWrite,
              },
              select: {
                id: true,
                reviewAssignmentId: true,
                vendorId: true,
                organizationId: true,
                evidenceRequestId: true,
                sourceKey: true,
                title: true,
                status: true,
                severity: true,
                dueAt: true,
                payload: true,
                createdAt: true,
                updatedAt: true,
              },
            });

          if (pkg.evidenceRequestId) {
            await tx.evidenceRequest.update({
              where: {
                id: pkg.evidenceRequestId,
              },
              data: {
                label:
                  vendorTitle.slice(0, 240),
                title: vendorTitle,
                description:
                  vendorDescription ||
                  "Truvern requires remediation evidence before this review can be completed.",
                dueAt: nextDueAt,
              },
            });
          }

          return packageRow;
        },
      );

    return NextResponse.json({
      ok: true,
      package: updated,
      changedFields,
      evidenceRequestSynchronized:
        Boolean(pkg.evidenceRequestId),
    });
  } catch (error: any) {
    const authError =
      governanceAuthErrorResponse(error);

    if (authError) {
      return authError;
    }
    return NextResponse.json(
      {
        ok: false,
        error: String(
          error?.message ||
            "Unable to update remediation package.",
        ),
      },
      {
        status: 500,
      },
    );
  }
}