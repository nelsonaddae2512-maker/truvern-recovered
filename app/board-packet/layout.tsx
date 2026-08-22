import type { Metadata } from "next";
import {
  requireDeploymentAccess,
} from "@/lib/licensing/deployment-access";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default async function NoIndexLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireDeploymentAccess();

  return children;
}
