/**
 * Accept only application-relative onboarding destinations.
 *
 * Unsafe values fall back to /vendors.
 * This function must remain usable in both server and client code.
 */
export function safeOnboardingReturnPath(
  candidate: string | null | undefined,
): string {
  const fallback = "/vendors";

  if (typeof candidate !== "string") {
    return fallback;
  }

  if (!candidate.startsWith("/") || candidate.startsWith("//")) {
    return fallback;
  }

  // Reject backslashes and ASCII controls, including encoded forms.
  if (/[\\\u0000-\u001F\u007F]/.test(candidate)) {
    return fallback;
  }

  let decoded: string;

  try {
    decoded = decodeURIComponent(candidate);
  } catch {
    return fallback;
  }

  if (
    !decoded.startsWith("/") ||
    decoded.startsWith("//") ||
    /[\\\u0000-\u001F\u007F]/.test(decoded)
  ) {
    return fallback;
  }

  // Reject encoded path separators and repeated decoding ambiguity.
  if (/%(?:2f|5c|0[0-9a-f]|1[0-9a-f]|7f)/i.test(candidate)) {
    return fallback;
  }

  const pathname = decoded.split(/[?#]/, 1)[0];

  if (
    pathname === "/select-org" ||
    pathname.startsWith("/select-org/")
  ) {
    return fallback;
  }

  return candidate;
}