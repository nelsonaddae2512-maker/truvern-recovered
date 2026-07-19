import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: [
          "/",
          "/features",
          "/pricing",
          "/contact",
          "/demo",
          "/trust-network",
          "/truvern-reviews",
          "/privacy",
          "/terms",
          "/security",
          "/cookies",
          "/dpa",
          "/subprocessors",
        ],
        disallow: [
          "/api/",
          "/dashboard",
          "/billing",
          "/review-desk",
          "/governance-ops",
          "/vendor-portal",
          "/vendors",
          "/truvern/ops",
          "/board-packet",
          "/select-org",
          "/settings",
          "/notifications",
        ],
      },
    ],
  };
}
