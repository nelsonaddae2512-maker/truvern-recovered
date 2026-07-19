/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Allow production builds to complete even if ESLint reports issues.
    ignoreDuringBuilds: true,
  },

  serverExternalPackages: ["@prisma/client", "prisma"],

  // Remove floating "N" dev indicator
  devIndicators: false,
};

module.exports = nextConfig;