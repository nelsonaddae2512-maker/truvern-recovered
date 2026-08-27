import {
  auth,
  currentUser,
} from "@clerk/nextjs/server";

import {
  NextResponse,
} from "next/server";

import prisma
  from "@/lib/prisma";

import {
  bindVendorPortalUser,
} from "@/lib/vendor-portal";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

export const revalidate =
  0;

function json(
  status: number,
  body: unknown,
) {
  return NextResponse.json(
    body,
    {
      status,
    },
  );
}

function parsePositiveInt(
  value: unknown,
) {
  const parsed =
    Number(
      String(
        value ?? "",
      ).trim(),
    );

  if (
    !Number.isInteger(
      parsed,
    ) ||
    parsed <= 0
  ) {
    return null;
  }

  return parsed;
}

function normalizeEmail(
  value: unknown,
) {
  return String(
    value ?? "",
  )
    .trim()
    .toLowerCase();
}

export async function POST(
  request: Request,
) {
  try {

    const session =
      await auth();

    const clerkUserId =
      session.userId;

    if (!clerkUserId) {
      return json(
        401,
        {
          ok:
            false,

          error:
            "Authentication required.",
        },
      );
    }

    const body =
      await request
        .json()
        .catch(
          () => ({}),
        );

    const assessmentId =
      parsePositiveInt(
        (
          body as {
            assessmentId?: unknown;
          }
        ).assessmentId,
      );

    if (!assessmentId) {
      return json(
        400,
        {
          ok:
            false,

          error:
            "A valid assessment id is required.",
        },
      );
    }

    /*
     * Trusted identity source #1:
     * framework assessment determines organizationId + vendorId.
     */
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

            organizationId:
              true,

            vendorId:
              true,
          },
        });

    if (
      !assessment ||
      !assessment.organizationId ||
      !assessment.vendorId
    ) {
      return json(
        404,
        {
          ok:
            false,

          error:
            "Framework assessment not found.",
        },
      );
    }

    /*
     * Trusted identity source #2:
     * load the exact vendor separately because
     * TruvernFrameworkAssessment exposes vendorId but
     * does not currently expose a Prisma vendor relation.
     */
    const vendor =
      await prisma.vendor.findFirst({
        where: {
          id:
            assessment.vendorId,

          organizationId:
            assessment.organizationId,
        },

        select: {
          id:
            true,

          organizationId:
            true,

          contactEmail:
            true,

          contacts: {
            select: {
              email:
                true,
            },
          },
        },
      });

    if (!vendor) {
      return json(
        404,
        {
          ok:
            false,

          error:
            "Assessment vendor could not be resolved.",
        },
      );
    }

    const user =
      await currentUser();

    if (!user) {
      return json(
        401,
        {
          ok:
            false,

          error:
            "Authenticated Clerk user could not be resolved.",
        },
      );
    }

    /*
     * Only verified Clerk email addresses may establish
     * a vendor identity binding.
     */
    const authenticatedEmails =
      new Set(
        (
          user.emailAddresses ??
          []
        )
          .filter(
            (entry) =>
              entry.verification
                ?.status ===
              "verified",
          )
          .map(
            (entry) =>
              normalizeEmail(
                entry.emailAddress,
              ),
          )
          .filter(Boolean),
      );

    if (
      authenticatedEmails.size ===
      0
    ) {
      return json(
        403,
        {
          ok:
            false,

          error:
            "Authenticated user has no verified vendor email identity.",
        },
      );
    }

    const permittedEmails =
      new Set<string>();

    const primaryEmail =
      normalizeEmail(
        vendor.contactEmail,
      );

    if (primaryEmail) {
      permittedEmails.add(
        primaryEmail,
      );
    }

    for (
      const contact
      of vendor.contacts
    ) {

      const email =
        normalizeEmail(
          contact.email,
        );

      if (email) {
        permittedEmails.add(
          email,
        );
      }
    }

    if (
      permittedEmails.size ===
      0
    ) {
      return json(
        409,
        {
          ok:
            false,

          error:
            "This vendor has no configured contact email eligible for portal access.",
        },
      );
    }

    const matchedEmail =
      Array.from(
        authenticatedEmails,
      ).find(
        (email) =>
          permittedEmails.has(
            email,
          ),
      ) ??
      null;

    if (!matchedEmail) {
      return json(
        403,
        {
          ok:
            false,

          error:
            "Authenticated identity does not match an authorized contact for this vendor.",
        },
      );
    }

    const portalUser =
      await bindVendorPortalUser({
        clerkUserId,

        organizationId:
          assessment.organizationId,

        vendorId:
          assessment.vendorId,
      });

    return json(
      200,
      {
        ok:
          true,

        assessmentId:
          assessment.id,

        vendorId:
          portalUser.vendorId,

        organizationId:
          portalUser.organizationId,

        matchedEmail,
      },
    );
  }
  catch (error) {

    console.error(
      "Vendor portal bootstrap failed:",
      error,
    );

    return json(
      500,
      {
        ok:
          false,

        error:
          "Unable to establish vendor portal identity.",
      },
    );
  }
}