import { randomBytes } from "crypto";
import prisma from "@/lib/prisma";

const VENDOR_FRAMEWORK_TOKEN_BYTES = 32;
const VENDOR_FRAMEWORK_TOKEN_PATTERN = /^[A-Za-z0-9_-]{40,128}$/;

export function generateVendorFrameworkAssessmentToken() {
  return randomBytes(VENDOR_FRAMEWORK_TOKEN_BYTES).toString("base64url");
}

export function normalizeVendorFrameworkAssessmentToken(
  value: string | null | undefined,
) {
  const token = String(value ?? "").trim();

  if (!VENDOR_FRAMEWORK_TOKEN_PATTERN.test(token)) {
    return null;
  }

  return token;
}

export async function findVendorFrameworkAssessmentByToken(
  rawToken: string,
) {
  const token =
    normalizeVendorFrameworkAssessmentToken(rawToken);

  if (!token) {
    return null;
  }

  return prisma.truvernFrameworkAssessment.findUnique({
    where: {
      vendorToken: token,
    },
    include: {
      framework: true,
      responses: {
        include: {
          question: {
            include: {
              control: true,
            },
          },
        },
        orderBy: {
          questionId: "asc",
        },
      },
    },
  });
}