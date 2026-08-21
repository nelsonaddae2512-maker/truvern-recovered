/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["@prisma/client", "prisma"],

  // Remove floating "N" dev indicator
  devIndicators: false,
};

export default nextConfig;