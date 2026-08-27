// middleware.ts
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

/**
 * Public routes (no auth required)
 */
const isPublicRoute = createRouteMatcher([
  "/",
  "/pricing",
  "/truvern-reviews(.*)",
  "/contact",
  "/features",
  "/trust-network",
  "/assessment/demo",
  "/sign-in(.*)",
  "/sign-up(.*)",

  // Public cryptographic verification surfaces.
  // No customer-private assessment data is exposed by this page.
  "/verify(.*)",

  // Board packet supports public token mode
  "/board-packet(.*)",

  // Org bootstrap page must be reachable
  "/select-org(.*)",
]);

/**
 * API routes that must NOT redirect to /sign-in from middleware.
 * Route handlers should return JSON/CSV status codes.
 */
const isApiNoRedirectRoute = createRouteMatcher([
  "/api/cron(.*)",
  "/api/issues(.*)",

  // Organization-scoped vendor APIs own their JSON auth responses.
  // Do not replace API 401/403 responses with Clerk HTML redirects.
  "/api/vendors(.*)",
  "/api/review-desk(.*)",
  "/api/governance(.*)",
  "/api/truvern/ops(.*)",
  "/api/stripe/webhook",

  // Resend inbound email webhook.
  // Authenticated by Svix/Resend signature verification,
  // not by a Clerk browser session.
  "/api/webhooks/resend",
  // ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã¢â‚¬Å“ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ canonical trust network export route
  "/api/trust-network-export(.*)",

  // ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã¢â‚¬Å“ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ legacy shim route must also not redirect (so it can 307 ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ canonical)
  "/api/trust-network/export(.*)",

  "/api/auth/(.*)",
]);

export default clerkMiddleware(async (authFn, req) => {
  const res = NextResponse.next();

  // ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã¢â‚¬Å“ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ CRITICAL: always call authFn() so Clerk can hydrate request auth
  const a = await authFn();

  // Optional: lightweight dev-only marker (no identifiers)
  if (process.env.NODE_ENV !== "production") {
    res.headers.set("x-truvern-mw", "1");
  }


  const pathname = req.nextUrl.pathname;

  const shouldNoIndex =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/vendors") ||
    pathname.startsWith("/review-desk") ||
    pathname.startsWith("/assessments") ||
    pathname.startsWith("/billing") ||
    pathname.startsWith("/truvern") ||
    pathname.startsWith("/board-packet") ||
    pathname.startsWith("/api");

  if (shouldNoIndex) {
    res.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  }

  // Public routes always allowed
  if (isPublicRoute(req)) return res;

  // API routes: never redirect (let handlers return JSON/CSV status)
  if (isApiNoRedirectRoute(req)) return res;

  // Protected pages: require sign-in
  if (!a.userId) {
    return a.redirectToSignIn({ returnBackUrl: req.url });
  }

  return res;
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
